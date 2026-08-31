import {
  Body,
  Controller,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  UseGuards
} from '@nestjs/common'
import { Request, Response } from 'express'
import { UserService } from './user.service'
import { Authorized } from '@/auth/decorators/authorized.decorator'
import { Authorization } from '@/auth/decorators/auth.decorator'
import { UserRole } from '@/generated/prisma/enums'
import { UpdateUserDto } from './dto/update-user.dto'
import { VerifyBusinessDto } from './dto/verify-business.dto'
import { FileService } from '@/file/file.service'
import { FileInterceptor } from '@nestjs/platform-express'
import { PasswordChangeDto } from './dto/password-change.dto'
import { PhoneChangeDto } from './dto/phone-change.dto'
import { ConfirmPhoneChangeDto } from './dto/confirm-phone-change.dto'
import { SetPrimaryPhoneDto } from './dto/set-primary-phone.dto'
import { DeleteAccountDto } from './dto/delete-account.dto'
import { PhoneThrottlerGuard } from '@/libs/common/guards/phone-throttler.guard'
import { ConfigService } from '@nestjs/config'

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly fileService: FileService,
    private readonly configService: ConfigService
  ) {}

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Get('profile')
  async findProfile(@Authorized('id') userId: string) {
    return this.userService.getProfileForClient(userId)
  }

  @Authorization(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Get('by-id/:id')
  async findById(@Param('id') id: string) {
    return this.userService.findById(id)
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Patch('profile')
  async updateProfile(@Authorized('id') userId: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(userId, dto)
  }

  // Подтверждение ИП/компании по ИНН через DaData — см.
  // UserService.verifyBusiness. Отдельный POST, а не часть updateProfile:
  // требует внешнего запроса и может провалиться независимо от остальных
  // полей формы настроек.
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Post('profile/business-verification')
  async verifyBusiness(@Authorized('id') userId: string, @Body() dto: VerifyBusinessDto) {
    return this.userService.verifyBusiness(userId, dto.inn)
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Patch('profile/avatar')
  @UseInterceptors(FileInterceptor('file'))
  async updateAvatar(
    @Authorized('id') userId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }), // 5МБ
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|webp)' })
        ]
      })
    )
    file: Express.Multer.File
  ) {
    const uploadResult = await this.fileService.uploadFile(file, 'avatars')

    return this.userService.updateAvatar(userId, uploadResult.url)
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Patch('profile/password')
  async updatePassword(@Authorized('id') userId: string, @Body() dto: PasswordChangeDto) {
    return this.userService.updatePassword(userId, dto)
  }

  @Patch('2fa')
  @HttpCode(HttpStatus.OK)
  @Authorization() // Твой декоратор для защиты роута
  async toggleTwoFactor(@Authorized('id') userId: string) {
    return this.userService.toggleTwoFactor(userId)
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @UseGuards(PhoneThrottlerGuard)
  @Post('profile/change-phone/request')
  async requestPhoneChange(@Authorized('id') userId: string, @Body() dto: PhoneChangeDto) {
    return this.userService.requestPhoneChange(userId, dto.newPhone)
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Patch('profile/change-phone/confirm')
  async confirmPhoneChange(@Authorized('id') userId: string, @Body() dto: ConfirmPhoneChangeDto) {
    return this.userService.confirmPhoneChange(userId, dto.code)
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @UseGuards(PhoneThrottlerGuard)
  @Post('profile/phones/request')
  async requestAddPhone(@Authorized('id') userId: string, @Body() dto: PhoneChangeDto) {
    return this.userService.requestPhoneChange(userId, dto.newPhone)
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Patch('profile/phones/confirm')
  async confirmAddPhone(@Authorized('id') userId: string, @Body() dto: ConfirmPhoneChangeDto) {
    return this.userService.confirmAddPhone(userId, dto.code, dto.makePrimary)
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Patch('profile/phones/primary')
  async setPrimaryPhone(@Authorized('id') userId: string, @Body() dto: SetPrimaryPhoneDto) {
    return this.userService.setPrimaryPhone(userId, dto.phone)
  }

  // Опрашивается с фронта, пока пользователь не позвонит на выданный
  // номер — общий для обоих флоу (смена номера и добавление номера),
  // они используют один и тот же тип токена (см. UserService.checkPhoneCallbackStatus).
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Post('profile/phones/status')
  async checkPhoneCallbackStatus(@Authorized('id') userId: string) {
    return this.userService.checkPhoneCallbackStatus(userId)
  }

  // POST, а не DELETE — нужно передать пароль для подтверждения в теле
  // запроса, а клиентский FetchClient.delete() тела не поддерживает (см.
  // shared/fetch/fetch-client.ts). После удаления сразу же гасим сессию —
  // тем же способом, что и AuthService.logout, — чтобы обезличенный аккаунт
  // не остался залогинен в текущей вкладке.
  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Post('profile/delete')
  async deleteAccount(
    @Authorized('id') userId: string,
    @Body() dto: DeleteAccountDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    await this.userService.deleteAccount(userId, dto)

    return new Promise<{ success: boolean }>((resolve, reject) => {
      req.session.destroy(err => {
        if (err) {
          return reject(
            new InternalServerErrorException(
              'Аккаунт удалён, но не удалось завершить текущую сессию. Пожалуйста, выйдите вручную.'
            )
          )
        }

        res.clearCookie(this.configService.getOrThrow<string>('SESSION_NAME'))
        resolve({ success: true })
      })
    })
  }
}
