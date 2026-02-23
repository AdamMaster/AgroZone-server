import 'express-session'
import { UserRole } from 'prisma/generated/client'

declare module 'express-session' {
  interface SessionData {
    userId: string
    userRole: UserRole
  }
}
