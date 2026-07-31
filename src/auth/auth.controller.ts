import { ConfigService } from '@nestjs/config'
import { ProviderService } from './provider/provider.service'
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards
} from '@nestjs/common'
import { AuthService } from './auth.service'
import { RegisterDto } from './dto/register.dto'
import { Request, Response } from 'express'
import { LoginDto } from './dto/login.dto'
import { Recaptcha } from '@nestlab/google-recaptcha'
import { AuthProviderGuard } from './guards/provider.quard'
import { CheckUserDto } from './dto/check-user.dto'
import { VerifySmsDto } from './dto/verify-sms.dto'
import { SmsRegisterDto } from './dto/sms-register.dto'
import { SmsCompleteDto } from './dto/sms-complete.dto'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'

// Более мягкий лимит для запроса самого кода (SMS/email) — раз в 30 секунд
// не даёт спамить провайдера SMS/почты, но не мешает нормальному пользователю.
const REQUEST_CODE_THROTTLE = { default: { limit: 3, ttl: 60000 } }

// Более жёсткий лимит для проверки кода — именно здесь возможен брутфорс.
const VERIFY_CODE_THROTTLE = { default: { limit: 5, ttl: 60000 } }

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly providerService: ProviderService,
    private readonly configService: ConfigService
  ) {}

  @UseGuards(ThrottlerGuard)
  @Throttle(REQUEST_CODE_THROTTLE)
  @Post('register/sms/start')
  @HttpCode(HttpStatus.OK)
  async registerSmsStart(@Body() dto: SmsRegisterDto) {
    return this.authService.registerSmsStart(dto)
  }

  @UseGuards(ThrottlerGuard)
  @Throttle(VERIFY_CODE_THROTTLE)
  @Post('register/sms/complete')
  @HttpCode(HttpStatus.OK)
  async registerSmsComplete(@Req() req: Request, @Body() dto: SmsCompleteDto) {
    return this.authService.registerSmsComplete(req, dto)
  }

  @UseGuards(ThrottlerGuard)
  @Throttle(VERIFY_CODE_THROTTLE)
  @Post('verify-sms')
  @HttpCode(HttpStatus.OK)
  async verifySms(@Req() req: Request, @Body() dto: VerifySmsDto) {
    return this.authService.verifySms(req, dto)
  }

  @UseGuards(ThrottlerGuard)
  @Throttle(VERIFY_CODE_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('register/check-code')
  async checkRegisterCode(@Body() dto: VerifySmsDto) {
    return this.authService.checkRegisterCode(dto)
  }

  @Recaptcha()
  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(@Req() req: Request, @Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  @UseGuards(ThrottlerGuard)
  @Throttle(VERIFY_CODE_THROTTLE)
  @Post('check-user')
  @HttpCode(HttpStatus.OK)
  async checkUser(@Body() dto: CheckUserDto) {
    return this.authService.checkUser(dto)
  }

  @Recaptcha()
  @UseGuards(ThrottlerGuard)
  @Throttle(VERIFY_CODE_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Req() req: Request, @Body() dto: LoginDto) {
    return this.authService.login(req, dto)
  }

  @UseGuards(AuthProviderGuard)
  @Get('/oauth/connect/:provider')
  async connect(@Param('provider') provider: string) {
    const providerInstance = this.providerService.findByService(provider)

    return {
      url: providerInstance?.getAuthUrl()
    }
  }

  @Get('/oauth/callback/:provider')
  @UseGuards(AuthProviderGuard)
  async callback(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query('code') code: string,
    @Param('provider') provider: string
  ) {
    if (!code) {
      throw new BadRequestException('Не был предоставлен код авторизации.')
    }

    await this.authService.extractProfileFromCode(req, provider, code)

    return res.redirect(`${this.configService.getOrThrow<string>('ALLOWED_ORIGIN')}/profile/settings`)
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.logout(req, res)
  }
}
