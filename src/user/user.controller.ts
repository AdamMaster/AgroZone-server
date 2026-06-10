import {
  Body,
  Controller,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards
} from '@nestjs/common'
import { UserService } from './user.service'
import { Authorized } from '@/auth/decorators/authorized.decorator'
import { Authorization } from '@/auth/decorators/auth.decorator'
import { UserRole } from 'prisma/generated/enums'
import { UpdateUserDto } from './dto/update-user.dto'
import { FileService } from '@/file/file.service'
import { FileInterceptor } from '@nestjs/platform-express'
import { PasswordChangeDto } from './dto/password-change.dto'
import { PhoneChangeDto } from './dto/phone-change.dto'
import { ConfirmPhoneChangeDto } from './dto/confirm-phone-change.dto'
import { ThrottlerGuard } from '@nestjs/throttler'

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly fileService: FileService
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
  @UseGuards(ThrottlerGuard)
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
}
