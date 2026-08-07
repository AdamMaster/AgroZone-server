// Единая проверка "премиум активен сейчас" — везде, где нужно решить,
// давать ли премиум-лимиты/плюшки, сравниваем с этой функцией, а не с
// role (role.PREMIUM больше не используется, см. schema.prisma).
export const isPremiumActive = (premiumUntil: Date | null | undefined): boolean => {
  return !!premiumUntil && premiumUntil > new Date()
}
