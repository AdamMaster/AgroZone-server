import { ConfigService } from '@nestjs/config'

const WEAK_VALUES = new Set(['secret', 'changeme', 'change-me', 'password', '123456', 'default', ''])
const MIN_SECRET_LENGTH = 32

function isWeak(value: string): boolean {
  return WEAK_VALUES.has(value.toLowerCase()) || value.length < MIN_SECRET_LENGTH
}

// Защита от того, чтобы "секреты для разработки" случайно уехали на прод.
// SESSION_SECRET/COOKIES_SECRET в деве часто равны чему-то простому вроде
// 'secret' — это нормально локально, но если .env с такими значениями
// попадёт на боевой сервер без замены, подпись сессионной куки становится
// тривиально подделываемой, а сама кука (без Secure) может улететь по
// незащищённому соединению. Проверяем это один раз при старте приложения:
// если окружение продакшн, а секреты слабые/дефолтные — падаем сразу с
// понятной ошибкой, а не тихо работаем в незащищённом виде.
export function assertSecureSessionConfig(config: ConfigService): void {
  const nodeEnv = config.get<string>('NODE_ENV')

  if (nodeEnv !== 'production') return

  const sessionSecret = config.getOrThrow<string>('SESSION_SECRET')
  const cookiesSecret = config.getOrThrow<string>('COOKIES_SECRET')
  const sessionSecure = config.getOrThrow<string>('SESSION_SECURE')

  if (isWeak(sessionSecret)) {
    throw new Error(
      `SESSION_SECRET выглядит как значение для разработки (пустое, короткое или из списка стандартных). ` +
        `В продакшене нужен случайный секрет длиной от ${MIN_SECRET_LENGTH} символов.`
    )
  }

  if (isWeak(cookiesSecret)) {
    throw new Error(
      `COOKIES_SECRET выглядит как значение для разработки (пустое, короткое или из списка стандартных). ` +
        `В продакшене нужен случайный секрет длиной от ${MIN_SECRET_LENGTH} символов.`
    )
  }

  if (sessionSecure.toLowerCase() !== 'true') {
    throw new Error(
      'SESSION_SECURE должен быть true в продакшене — сессионная кука обязана передаваться только по HTTPS.'
    )
  }
}
