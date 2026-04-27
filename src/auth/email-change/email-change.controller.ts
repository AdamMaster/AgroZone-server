import { Body, Controller, HttpCode, HttpStatus, Post, Query } from '@nestjs/common'
import { EmailChangeService } from './email-change.service'
import { ChangeEmailDto } from './dto/email-change.dto'
import { Recaptcha } from '@nestlab/google-recaptcha'
import { Authorization } from '../decorators/auth.decorator'
import { CurrentUser } from '../decorators/decorators/user.decorator'

@Controller('auth/email-change')
export class EmailChangeController {
  constructor(private readonly emailChangeService: EmailChangeService) {}

  // 1. Создание запроса на смену почты
  @Recaptcha()
  @Authorization()
  @Post()
  @HttpCode(HttpStatus.OK)
  async requestChange(@CurrentUser('id') userId: string, @Body() dto: ChangeEmailDto) {
    return this.emailChangeService.requestEmailChange(userId, dto)
  }

  // 2. Подтверждение из письма
  @Recaptcha()
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  async confirmChange(@Query('token') token: string) {
    return this.emailChangeService.confirmEmailChange(token)
  }
}
