import { Injectable } from '@nestjs/common'
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler'

// Обычный ThrottlerGuard при превышении лимита кидает
// ThrottlerException с англоязычным сообщением по умолчанию
// ('ThrottlerException: Too Many Requests'), которое долетает до
// фронта как есть и показывается пользователю. Переопределяем текст на
// понятный по-русски — используется на роутах запроса SMS-кода для
// номера телефона (UserController: profile/change-phone/request,
// profile/phones/request), где лимит — 3 попытки в минуту (см.
// ThrottlerModule.forRoot в app.module.ts).
@Injectable()
export class PhoneThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(): Promise<void> {
    throw new ThrottlerException('Слишком много попыток. Подождите минуту и попробуйте ещё раз')
  }
}
