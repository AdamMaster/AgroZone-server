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

interface ZvonokConfirmResponse {
  status: string
  data?: {
    balance: string
    call_id: number
    created: string
    phone: string
    pincode: string
  }
}

interface ZvonokCallStatus {
  call_id: number
  status: string
  status_display: string
  dial_status: number
  dial_status_display: string
  completed: string | null
}

@Injectable()
export class ZvonokService {
  private readonly logger = new Logger(ZvonokService.name)

  constructor(private readonly configService: ConfigService) {}

  // Не используется активно (заменено на requestCallbackConfirmation +
  // checkCallbackConfirmed, см. ниже) — оставлен на случай, если придётся
  // откатиться на диктовку кода роботом.
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

  // "Звонок на проверочный номер" — в отличие от tellcode/flashcall, тут
  // МЫ никому не звоним. Пользователь сам звонит на общий бесплатный номер
  // zvonok (ZVONOK_CONFIRM_NUMBER), а мы узнаём об этом через
  // checkCallbackConfirmed. Этот метод только регистрирует у zvonok
  // ожидание такого звонка с указанного номера и возвращает call_id —
  // именно по нему потом ищем совпадение в calls_by_phone.
  //
  // Причина перехода на этот способ: исходящие звонки робота (flashcall,
  // tellcode) операторы всё чаще блокируют антиспам-фильтрами как
  // "звонки от бизнеса" — если номер в zvonok не идентифицирован, звонок
  // может просто не дойти. Входящий звонок ОТ пользователя такими
  // фильтрами не режется.
  async requestCallbackConfirmation(phone: string): Promise<{ callId: string; number: string }> {
    const publicKey = this.configService.getOrThrow<string>('ZVONOK_PUBLIC_KEY')
    const campaignId = this.configService.getOrThrow<string>('ZVONOK_CONFIRM_CAMPAIGN_ID')
    const number = this.configService.getOrThrow<string>('ZVONOK_CONFIRM_NUMBER')

    const formData = new FormData()

    formData.append('public_key', publicKey)
    formData.append('phone', `+${phone}`)
    formData.append('campaign_id', campaignId)

    let response: globalThis.Response

    try {
      response = await fetch('https://zvonok.com/manager/cabapi_external/api/v1/phones/confirm/', {
        method: 'POST',
        body: formData
      })
    } catch (error) {
      this.logger.error('Zvonok недоступен', error as Error)

      throw new InternalServerErrorException(
        'Не удалось связаться с сервисом подтверждения номера. Попробуйте чуть позже.'
      )
    }

    const data = (await response.json().catch(() => null)) as ZvonokConfirmResponse | null

    if (!response.ok || data?.status !== 'ok' || !data.data?.call_id) {
      this.logger.error(`Zvonok confirm не удался: ${response.status} ${JSON.stringify(data)}`)

      throw new InternalServerErrorException(
        'Не удалось подготовить проверку номера. Проверьте номер телефона и попробуйте снова.'
      )
    }

    return { callId: String(data.data.call_id), number }
  }

  // Опрашивается с фронта каждые несколько секунд, пока пользователь не
  // позвонит. callId — тот, что вернул requestCallbackConfirmation.
  async checkCallbackConfirmed(phone: string, callId: string): Promise<boolean> {
    const publicKey = this.configService.getOrThrow<string>('ZVONOK_PUBLIC_KEY')
    const campaignId = this.configService.getOrThrow<string>('ZVONOK_CONFIRM_CAMPAIGN_ID')

    const params = new URLSearchParams({
      public_key: publicKey,
      phone: `+${phone}`,
      campaign_id: campaignId
    })

    let response: globalThis.Response

    try {
      response = await fetch(`https://zvonok.com/manager/cabapi_external/api/v1/phones/calls_by_phone/?${params}`)
    } catch (error) {
      this.logger.error('Zvonok недоступен при проверке статуса', error as Error)

      // Не бросаем исключение наружу — сюда прилетают частые запросы с
      // опроса на фронте, разовый сетевой сбой не должен превращаться в
      // ошибку на экране пользователя, просто считаем, что пока не
      // подтверждено, фронт спросит ещё раз через пару секунд.
      return false
    }

    if (!response.ok) {
      return false
    }

    const data = (await response.json().catch(() => null)) as ZvonokCallStatus[] | null

    if (!Array.isArray(data)) {
      return false
    }

    // dial_status 5 = "Абонент ответил". status "pincode_ok" — это общий
    // статус "успешно подтверждено" у zvonok для верификационных кампаний,
    // используется даже когда пинкода как такового нет (наш случай).
    return data.some(call => String(call.call_id) === callId && call.status === 'pincode_ok')
  }
}
