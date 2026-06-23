export type CurrentUserType = {
  id: string
  email: string | null
  phone: string | null
  displayName: string | null
  picture: string | null
  role: 'REGULAR' | 'PREMIUM' | 'ADMIN'
  isVerified: boolean
}
