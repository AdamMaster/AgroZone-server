import { createHash } from 'crypto'
import { Request } from 'express'

// Идентификатор посетителя для дедупа просмотров объявления (см.
// AdsService.findOne/recordView и модель AdView в schema.prisma).
//
// Для залогиненного — просто userId, стабильный и точный. Для анонима —
// хэш от IP + User-Agent: сырой IP не храним вообще (это персональные
// данные по 152-ФЗ), хэша достаточно, чтобы не засчитывать одного и того
// же посетителя дважды в течение дня. Точность тут не критична — это не
// биллинг и не точная аналитика, а грубая статистика "сколько людей
// интересовалось объявлением" для его владельца.
//
// Если сайт когда-нибудь окажется за прокси/CDN — потребуется явно
// настроить `trust proxy` в Express (сейчас нигде не настроено), иначе
// request.ip будет показывать IP самого прокси и все анонимные визиты
// схлопнутся в один viewerKey.
export function computeViewerKey(userId: string | undefined, request: Request): string {
  if (userId) {
    return `user:${userId}`
  }

  const ip = request.ip ?? 'unknown'
  const userAgent = request.headers['user-agent'] ?? 'unknown'

  return `anon:${createHash('sha256').update(`${ip}:${userAgent}`).digest('hex')}`
}
