import { AdServiceType } from '@/generated/prisma/enums'

// Срок действия каждой из трёх услуг после успешной оплаты, в днях.
// Одинаковый для всех — сознательное решение (см. обсуждение с
// пользователем): сначала запускаем с одним сроком для простоты, дальше
// можно развести по услугам отдельно, если понадобится.
export const AD_SERVICE_DURATION_DAYS = 7

// Цена каждой услуги, в копейках — сумма НЕ берётся от клиента никогда
// (см. AdServicesService.createCheckout), только эти константы. Пока все
// три на одной цене — плейсхолдер, поменять в любой момент, ничего в
// логике/схеме менять не придётся.
export const AD_SERVICE_PRICES_KOPECKS: Record<AdServiceType, number> = {
  [AdServiceType.BUMP]: 14900,
  [AdServiceType.PRICE_HIGHLIGHT]: 14900,
  [AdServiceType.BADGE]: 14900
}

// Человекочитаемые названия — переиспользуются и в description для ЮKassa,
// и (при необходимости) на фронте.
export const AD_SERVICE_LABELS: Record<AdServiceType, string> = {
  [AdServiceType.BUMP]: 'Поднять объявление',
  [AdServiceType.PRICE_HIGHLIGHT]: 'Выделить цену',
  [AdServiceType.BADGE]: 'Добавить значок'
}
