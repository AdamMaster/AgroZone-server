import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { Request } from 'express'
import { UserService } from '@/user/user.service'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()

    const userId = request.session?.userId

    if (!userId) {
      throw new UnauthorizedException(
        'Пользователь не авторизован. Пожалуйста, войдите в систему, чтобы получить доступ.'
      )
    }

    const user = await this.userService.findById(userId)

    if (!user) {
      throw new UnauthorizedException('Пользователь не найден')
    }

    request.user = user

    return true
  }
}
