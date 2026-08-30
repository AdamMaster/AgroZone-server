import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

interface ZvonokTellCodeResponse {
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
      // tellcode — робот дозванивается и голосом диктует код (в отличие от
      // flashcall, где код был просто последними цифрами номера, с которого
      // звонили, и трубку брать было не нужно). Кампания в кабинете zvonok
      // должна быть типа "Диктовка кода роботом", ZVONOK_CAMPAIGN_ID — id
      // именно такой кампании.
      response = await fetch('https://zvonok.com/manager/cabapi_external/api/v1/phones/tellcode/', {
        method: 'POST',
        body: formData
      })
    } catch (error) {
      this.logger.error('Zvonok недоступен', error as Error)

      throw new InternalServerErrorException(
        'Не удалось связаться с сервисом подтверждения номера. Попробуйте чуть позже.'
      )
    }

    const data = (await response.json().catch(() => null)) as ZvonokTellCodeResponse | null

    if (!response.ok || data?.status !== 'ok' || !data.data?.pincode) {
      this.logger.error(`Zvonok tellcode не удался: ${response.status} ${JSON.stringify(data)}`)

      throw new InternalServerErrorException(
        'Не удалось совершить звонок с кодом подтверждения. Проверьте номер телефона и попробуйте снова.'
      )
    }

    return data.data.pincode
  }
}
