import { randomInt } from 'crypto'

/**
 * Генерирует криптографически стойкий числовой код подтверждения (SMS, email, 2FA).
 * Раньше использовался Math.random() и 4 цифры (9000 вариантов) — это легко
 * перебирается скриптом при отсутствии rate limiting. Теперь по умолчанию
 * 6 цифр (900 000 вариантов) и crypto.randomInt вместо Math.random.
 */
export function generateSmsCode(): string {
  return randomInt(100000, 999999).toString()
}

export function generateNumericCode(digits = 6): string {
  const min = Math.pow(10, digits - 1)
  const max = Math.pow(10, digits) - 1
  return randomInt(min, max).toString()
}
