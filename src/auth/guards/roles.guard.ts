import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { UserRole } from '@/generated/prisma/enums'
import { ROLES_KEY } from '../decorators/roles.decorator'
import { Request } from 'express'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()])

    if (!roles) return true

    const request = context.switchToHttp().getRequest<Request>()

    const user = request.user

    if (!user || !user.role || !roles.includes(user.role)) {
      throw new ForbiddenException('Недостаточно прав. У вас нет прав доступа к этому ресурсу.')
    }

    return true
  }
}
