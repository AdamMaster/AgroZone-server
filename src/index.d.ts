import 'express-session'
import { User, UserRole } from 'prisma/generated/client'

declare module 'express-session' {
  interface SessionData {
    userId: string
    userRole: UserRole
  }
}

declare global {
  namespace Express {
    interface Request {
      user: User
    }
  }
}

export {}
