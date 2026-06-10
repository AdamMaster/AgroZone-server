import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { Request } from 'express'
import { UserService } from '@/user/user.service'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly UserService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()

    if (typeof request.session.userId === 'undefined') {
      throw new UnauthorizedException(
        'Пользователь не авторизован. Пожалуйста, войдите в систему, чтобы получить доступ.'
      )
    }

    const user = await this.UserService.findById(request.session.userId)

    request.user = user

    return true
  }
}
