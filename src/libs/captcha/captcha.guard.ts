import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Request } from 'express'

import { isDev } from '@/libs/common/utils/is-dev.util'

import { CaptchaService } from './captcha.service'

@Injectable()
export class CaptchaGuard implements CanActivate {
  constructor(
    private readonly captchaService: CaptchaService,
    private readonly configService: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (isDev(this.configService)) {
      return true
    }

    const request = context.switchToHttp().getRequest<Request>()
    const token = request.headers.recaptcha as string | undefined

    const isValid = await this.captchaService.validate(token, request.ip)

    if (!isValid) {
      throw new BadRequestException('Проверка капчи не пройдена. Обновите страницу и попробуйте снова.')
    }

    return true
  }
}
