import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

interface ZvonokFlashCallResponse {
  status: string
  data?: {
    balance: string
    call_id: number
    created: string
    phone: string
    pincode: string
  }
}

@Injectable()
export class ZvonokService {
  private readonly logger = new Logger(ZvonokService.name)

  constructor(private readonly configService: ConfigService) {}

  async sendVerificationCall(phone: string): Promise<string> {
    const publicKey = this.configService.getOrThrow<string>('ZVONOK_PUBLIC_KEY')
    const campaignId = this.configService.getOrThrow<string>('ZVONOK_CAMPAIGN_ID')

    const formData = new FormData()

    formData.append('public_key', publicKey)
    formData.append('phone', `+${phone}`)
    formData.append('campaign_id', campaignId)

    let response: globalThis.Response

    try {
      response = await fetch('https://zvonok.com/manager/cabapi_external/api/v1/phones/flashcall/', {
        method: 'POST',
        body: formData
      })
    } catch (error) {
      this.logger.error('Zvonok недоступен', error as Error)

      throw new InternalServerErrorException(
        'Не удалось связаться с сервисом подтверждения номера. Попробуйте чуть позже.'
      )
    }

    const data = (await response.json().catch(() => null)) as ZvonokFlashCallResponse | null

    if (!response.ok || data?.status !== 'ok' || !data.data?.pincode) {
      this.logger.error(`Zvonok flashcall не удался: ${response.status} ${JSON.stringify(data)}`)

      throw new InternalServerErrorException(
        'Не удалось совершить звонок с кодом подтверждения. Проверьте номер телефона и попробуйте снова.'
      )
    }

    return data.data.pincode
  }
}
