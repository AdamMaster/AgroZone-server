import { applyDecorators, UseGuards } from '@nestjs/common'

import { CaptchaGuard } from './captcha.guard'

export const Captcha = () => applyDecorators(UseGuards(CaptchaGuard))
