import { BadRequestException } from '@nestjs/common'

export function normalizePhone(phone: string) {
  let normalized = phone.replace(/\D/g, '')

  if (normalized.length === 11 && normalized.startsWith('8')) {
    normalized = '7' + normalized.slice(1)
  }

  if (normalized.length < 10 || normalized.length > 15) {
    throw new BadRequestException('Некорректный номер телефона')
  }

  return normalized
}
