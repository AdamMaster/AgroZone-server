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
import { Captcha } from '@/libs/captcha/captcha.decorator'
import { AuthProviderGuard } from './guards/provider.quard'
import { CheckUserDto } from './dto/check-user.dto'
import { VerifySmsDto } from './dto/verify-sms.dto'
import { SmsRegisterDto } from './dto/sms-register.dto'
import { SmsCompleteDto } from './dto/sms-complete.dto'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import { randomBytes } from 'crypto'

// Более мягкий лимит для запроса самого кода (SMS/email) — раз в 30 секунд
// не даёт спамить провайдера SMS/почты, но не мешает нормальному пользователю.
const REQUEST_CODE_THROTTLE = { default: { limit: 3, ttl: 60000 } }

// Более жёсткий лимит для проверки кода — именно здесь возможен брутфорс.
const VERIFY_CODE_THROTTLE = { default: { limit: 5, ttl: 60000 } }

// Лимит для опроса статуса звонка (polling с фронта каждые несколько
// секунд, пока ждём, что пользователь позвонит на проверочный номер) —
// это не попытки подбора, ограничиваем только от совсем частого спама.
const POLL_STATUS_THROTTLE = { default: { limit: 30, ttl: 60000 } }

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

  // Опрашивается с фронта каждые несколько секунд, пока пользователь не
  // позвонит на выданный номер (см. AuthService.checkSmsCallbackStatus) —
  // лимит выше, чем у ручной проверки кода, это не брутфорс, а обычный polling.
  @UseGuards(ThrottlerGuard)
  @Throttle(POLL_STATUS_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('register/sms/status')
  async checkSmsCallbackStatus(@Body() dto: SmsRegisterDto) {
    return this.authService.checkSmsCallbackStatus(dto.phone)
  }

  @Captcha()
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

  @Captcha()
  @UseGuards(ThrottlerGuard)
  @Throttle(VERIFY_CODE_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Req() req: Request, @Body() dto: LoginDto) {
    return this.authService.login(req, dto)
  }

  @UseGuards(AuthProviderGuard)
  @Get('/oauth/connect/:provider')
  async connect(@Param('provider') provider: string, @Req() req: Request) {
    const providerInstance = this.providerService.findByService(provider)

    if (!providerInstance) {
      throw new BadRequestException(`Провайдер "${provider}" не найден.`)
    }

    // Защита от OAuth login CSRF: генерируем одноразовое значение,
    // кладём его в сессию и сверяем с тем, что провайдер вернёт в callback.
    const state = randomBytes(16).toString('hex')
    req.session.oauthState = state

    return {
      url: providerInstance.getAuthUrl(state)
    }
  }

  @Get('/oauth/callback/:provider')
  @UseGuards(AuthProviderGuard)
  async callback(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query('code') code: string,
    @Query('state') state: string,
    @Param('provider') provider: string
  ) {
    if (!code) {
      throw new BadRequestException('Не был предоставлен код авторизации.')
    }

    const expectedState = req.session.oauthState
    delete req.session.oauthState

    if (!expectedState || !state || state !== expectedState) {
      throw new BadRequestException(
        'Запрос авторизации недействителен или устарел (несовпадение state). Пожалуйста, попробуйте войти снова.'
      )
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
