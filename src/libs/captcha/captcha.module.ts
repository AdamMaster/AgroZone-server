import { Global, Module } from '@nestjs/common'

import { CaptchaGuard } from './captcha.guard'
import { CaptchaService } from './captcha.service'

@Global()
@Module({
  providers: [CaptchaService, CaptchaGuard],
  exports: [CaptchaService, CaptchaGuard]
})
export class CaptchaModule {}
