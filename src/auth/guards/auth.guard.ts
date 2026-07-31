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
      // Нейтральный текст: этот guard навешан на десятки разных роутов
      // (объявления, профиль, смена телефона/почты и т.д.), а не только
      // на избранное — сообщение не должно ссылаться на конкретное действие.
      throw new UnauthorizedException('Необходимо авторизоваться, чтобы выполнить это действие.')
    }

    const user = await this.userService.findById(userId)

    if (!user) {
      throw new UnauthorizedException('Пользователь не найден')
    }

    request.user = user

    return true
  }
}

@Injectable()
export class OptionalAuthGuard extends AuthGuard {
  handleRequest(err, user, info, context: ExecutionContext) {
    return user || null
  }
}
