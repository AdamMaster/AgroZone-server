import { isDev } from '@/libs/common/utils/is-dev.util'
import { ConfigService } from '@nestjs/config'
import { GoogleRecaptchaModuleOptions } from '@nestlab/google-recaptcha'
import { IncomingMessage } from 'http'

export const getRecaptchaConfig = (configService: ConfigService): GoogleRecaptchaModuleOptions => {
  const secretKey: string = configService.getOrThrow<string>('GOOGLE_RECAPTCHA_SECRET_KEY')

  return {
    secretKey,
    response: (req: IncomingMessage): string => req.headers.recaptcha as string,
    skipIf: isDev(configService),
    score: 0.5,
    actions: ['login', 'register', 'register_sms_start', 'forgot_password', 'reset_password']
  }
}
