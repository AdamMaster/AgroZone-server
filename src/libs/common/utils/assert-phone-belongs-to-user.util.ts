import { BadRequestException } from '@nestjs/common'

// Общая проверка для всех мест, где на вход приходит номер телефона,
// который обязан быть одним из уже подтверждённых номеров пользователя
// (например, номер объявления или переключение основного номера в
// профиле). Раньше в AdsService и UserService было по своей копии этой
// проверки — вынесли в один общий util, чтобы не расходились.
export function assertPhoneBelongsToUser(user: { phones: { phone: string }[] }, phone: string): void {
  const isKnown = user.phones.some(p => p.phone === phone)

  if (!isKnown) {
    throw new BadRequestException(
      'Этот номер телефона не подтверждён на вашем аккаунте. Сначала добавьте и подтвердите его в профиле.'
    )
  }
}
