import 'express-session'

declare module 'express-session' {
  interface SessionData {
    userId?: string
    // CSRF-защита для OAuth-логина: одноразовое случайное значение,
    // которое кладём в сессию перед редиректом на провайдера и сверяем в callback.
    oauthState?: string
  }
}
