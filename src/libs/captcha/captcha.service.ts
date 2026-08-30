import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

interface YandexCaptchaResponse {
  status: 'ok' | 'failed'
  message?: string
  host?: string
}

@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name)
  private readonly endpoint = 'https://smartcaptcha.cloud.yandex.ru/validate'

  constructor(private readonly configService: ConfigService) {}

  async validate(token: string | undefined, remoteIp?: string): Promise<boolean> {
    if (!token) {
      return false
    }

    const secret = this.configService.getOrThrow<string>('YANDEX_CAPTCHA_SECRET_KEY')

    const params = new URLSearchParams({ secret, token })
    if (remoteIp) {
      params.set('ip', remoteIp)
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      })

      const result = (await response.json()) as YandexCaptchaResponse

      if (result.status !== 'ok') {
        this.logger.debug(`Captcha validation failed: ${result.message || 'unknown reason'}`)
      }

      return result.status === 'ok'
    } catch (error) {
      this.logger.error('Captcha validation request failed', error instanceof Error ? error.stack : undefined)
      return false
    }
  }
}
