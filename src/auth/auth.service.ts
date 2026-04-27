import { EmailConfirmationService } from './email-confirmation/email-confirmation.service'

import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common'
import { RegisterDto } from './dto/register.dto'
import { UserService } from '@/user/user.service'
import { AuthMethod } from 'prisma/generated/enums'
import { User } from 'prisma/generated/client'
import { Request, Response } from 'express'
import { LoginDto } from './dto/login.dto'
import { verify } from 'argon2'
import { ConfigService } from '@nestjs/config'
import { ProviderService } from './provider/provider.service'
import { PrismaService } from '@/prisma/prisma.service'
import { TwoFactorAuthService } from './two-factor-auth/two-factor-auth.service'

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userService: UserService,
    private readonly confiService: ConfigService,
    private readonly providerService: ProviderService,
    private readonly emailConfirmationService: EmailConfirmationService,
    private readonly twoFactorAuthService: TwoFactorAuthService
  ) {}

  async register(dto: RegisterDto) {
    const isExists = await this.userService.findByEmail(dto.email)

    if (isExists) {
      throw new ConflictException(
        'Регистрация не удалась. Пользователь с таким email уже существует. Пожалуйста, используйте другой email, или войдите в систему.'
      )
    }

    const newUser = await this.userService.create(dto.email, dto.password, dto.name, '', AuthMethod.CREDENTIALS, false)

    await this.emailConfirmationService.sendVerificationToken(newUser.email)

    return {
      message:
        'Вы успешно зарегистрировались. Пожалуйста, подтвердите ваш email. Сообщение было отправлено на ваш почтовый адрес.'
    }
  }

  async extractProfileFromCode(req: Request, provider: string, code: string) {
    const providerInstance = this.providerService.findByService(provider)
    const profile = await providerInstance?.findUserByCode(code)

    const account = await this.prismaService.account.findFirst({
      where: {
        id: profile?.id,
        provider: profile?.provider
      }
    })

    let user = account?.userId ? await this.userService.findById(account.userId) : null

    if (!user && profile?.email) {
      user = await this.userService.findByEmail(profile.email)
    }

    if (user) {
      // Если аккаунта еще не было (зашли через новую соцсеть с существующей почтой) - создаем связку
      if (!account) {
        await this.prismaService.account.create({
          data: {
            userId: user.id,
            type: 'oauth',
            provider: profile?.provider ?? '',
            accessToken: profile?.access_token,
            refreshToken: profile?.refresh_token ?? null,
            expiresAt: profile?.expires_at ?? 0
          }
        })
      }
      return this.saveSession(req, user)
    }

    const providerKey = (profile?.provider?.toUpperCase() ?? '') as keyof typeof AuthMethod
    const method: AuthMethod = AuthMethod[providerKey] || AuthMethod.GOOGLE

    user = await this.userService.create(
      profile?.email ?? '',
      '',
      profile?.name ?? '',
      profile?.picture ?? '',
      method,
      true
    )

    if (!account) {
      await this.prismaService.account.create({
        data: {
          userId: user.id,
          type: 'oauth',
          provider: profile?.provider ?? '',
          accessToken: profile?.access_token,
          refreshToken: profile?.refresh_token ?? null,
          expiresAt: profile?.expires_at ?? 0
        }
      })
    }

    return this.saveSession(req, user)
  }

  async login(req: Request, dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email)

    if (!user || !user.password) {
      throw new NotFoundException('Пользователь не найден. Пожалуйста, проверьте введенные данные.')
    }

    const isValidPassword = await verify(user.password, dto.password)

    if (!isValidPassword) {
      throw new UnauthorizedException(
        'Неверный пароль. Пожалуйста, попробуйте еще раз, или восстановите пароль, если забыли его.'
      )
    }

    if (!user.isVerified) {
      await this.emailConfirmationService.sendVerificationToken(user.email)
      throw new UnauthorizedException('Ваш email не подтвержден. Пожалуйста,проверьте вашу почту и подтвердите адрес.')
    }

    if (user.isTwoFactorEnabled) {
      if (!dto.code) {
        await this.twoFactorAuthService.sendTwoFactorToken(user.email)

        return {
          message: 'Проверьте вашу почту. Требуется код двухфакторной аутентификации.'
        }
      }

      await this.twoFactorAuthService.validateTwoFactorToken(user.email, dto.code)
    }

    return this.saveSession(req, user)
  }

  async logout(req: Request, res: Response): Promise<void> {
    return new Promise((resolve, reject) => {
      req.session.destroy(err => {
        if (err) {
          return reject(
            new InternalServerErrorException(
              'Не удалось завершить сессию. Возможно, возникла проблема с сервером, или сессия уже была завершена.'
            )
          )
        }

        res.clearCookie(this.confiService.getOrThrow<string>('SESSION_NAME'))
        resolve()
      })
    })
  }

  async saveSession(req: Request, user: User) {
    return new Promise((resolve, reject) => {
      req.session.userId = user.id
      req.session.userRole = user.role

      req.session.save(err => {
        if (err) {
          console.error('SESSION SAVE ERROR:', err)
          return reject(
            new InternalServerErrorException(
              'Не удалось сохранить сессию. Проверьте правильно ли настроены параметры сессии.'
            )
          )
        }

        resolve({ user })
      })
    })
  }
}
