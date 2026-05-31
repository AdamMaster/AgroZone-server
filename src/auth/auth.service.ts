import { EmailConfirmationService } from './email-confirmation/email-confirmation.service'

import {
  BadRequestException,
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
import { VerifySmsDto } from './dto/verify-sms.dto'
import { SmsRegisterDto } from './dto/sms-register.dto'
import { SmsCompleteDto } from './dto/sms-complete.dto'

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    private readonly providerService: ProviderService,
    private readonly emailConfirmationService: EmailConfirmationService,
    private readonly twoFactorAuthService: TwoFactorAuthService
  ) {}

  async registerSmsStart(dto: SmsRegisterDto) {
    const isExists = await this.userService.findByPhone(dto.phone)

    if (isExists) {
      throw new ConflictException('Пользователь с таким номером телефона уже зарегистрирован.')
    }

    return await this.sendSmsCode(dto.phone)
  }

  async registerSmsComplete(req: Request, dto: SmsCompleteDto) {
    const smsToken = await this.prismaService.token.findFirst({
      where: {
        phone: dto.phone,
        token: dto.code,
        type: 'SMS_VERIFICATION'
      }
    })

    if (!smsToken) {
      throw new BadRequestException('Неверный код подтверждения')
    }

    if (new Date() > smsToken.expiresIn) {
      await this.prismaService.token.delete({ where: { id: smsToken.id } })
      throw new BadRequestException('Срок действия кода истек. Запросите новый.')
    }

    const newUser = await this.userService.create(
      null, // email
      dto.password, // пароль
      dto.name, // имя
      dto.phone, // телефон
      '', // picture
      AuthMethod.CREDENTIALS,
      true // isVerified сразу ставим true, так как код подошел
    )

    await this.prismaService.token.delete({ where: { id: smsToken.id } })

    return this.saveSession(req, newUser)
  }

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Укажите Email или номер телефона для регистрации')
    }

    const isExists = dto.email
      ? await this.userService.findByEmail(dto.email)
      : await this.userService.findByPhone(dto.phone!)

    if (isExists) {
      throw new ConflictException(`Пользователь с таким ${dto.email ? 'email' : 'номером телефона'} уже существует.`)
    }

    const newUser = await this.userService.create(
      dto.email ?? null,
      dto.password,
      dto.name,
      dto.phone ?? null,
      '',
      AuthMethod.CREDENTIALS,
      false
    )

    if (newUser.email) {
      await this.emailConfirmationService.sendVerificationToken(newUser.email)
      return { message: 'Пожалуйста, подтвердите ваш email.' }
    }

    if (newUser.phone) {
      await this.sendSmsCode(newUser.phone)
      return { message: 'Код подтверждения отправлен на ваш телефон.' }
    }

    return {
      message:
        'Вы успешно зарегистрировались. Пожалуйста, подтвердите ваш email. Сообщение было отправлено на ваш почтовый адрес.'
    }
  }

  async sendSmsCode(phone: string) {
    const code = Math.floor(1000 + Math.random() * 9000).toString()

    // Удаляем старые коды для этого номера
    await this.prismaService.token.deleteMany({
      where: { phone, type: 'SMS_VERIFICATION' }
    })

    const user = await this.userService.findByPhone(phone)

    await this.prismaService.token.create({
      data: {
        phone,
        token: code,
        type: 'SMS_VERIFICATION',
        expiresIn: new Date(Date.now() + 5 * 60 * 1000),
        ...(user ? { user: { connect: { id: user.id } } } : {})
      }
    })

    // Твой консоль-лог для дебага
    console.log(`\n--- [SMS.RU MOCK] ---`)
    console.log(`КОД ДЛЯ НОМЕРА ${phone}: ${code}`)
    console.log(`---------------------\n`)

    return { message: 'Код подтверждения отправлен на ваш телефон' }
  }

  async verifySms(req: Request, dto: VerifySmsDto) {
    // 1. Ищем токен в базе
    const smsToken = await this.prismaService.token.findFirst({
      where: {
        phone: dto.phone,
        token: dto.code,
        type: 'SMS_VERIFICATION'
      }
    })

    if (!smsToken) {
      throw new BadRequestException('Неверный код подтверждения или номер телефона')
    }

    // 2. Проверяем срок действия
    if (new Date() > smsToken.expiresIn) {
      await this.prismaService.token.delete({ where: { id: smsToken.id } })
      throw new BadRequestException('Срок действия кода истек. Запросите новый.')
    }

    // 3. Ищем пользователя и обновляем его статус
    const user = await this.userService.findByPhone(dto.phone)

    if (!user) {
      throw new NotFoundException('Пользователь с таким номером не найден')
    }

    await this.prismaService.user.update({
      where: { id: user.id },
      data: { isVerified: true }
    })

    // 4. Удаляем использованный токен
    await this.prismaService.token.delete({ where: { id: smsToken.id } })

    // 5. Логиним пользователя (сохраняем сессию)
    return this.saveSession(req, user)
  }

  async checkUser(dto: { identifier: string }) {
    const isEmail = dto.identifier.includes('@')
    let user: User | null = null

    if (isEmail) {
      user = await this.userService.findByEmail(dto.identifier)
    } else {
      const phone = dto.identifier.replace(/\D/g, '')
      user = await this.userService.findByPhone(phone)
    }

    return {
      exists: !!user,
      type: isEmail ? 'EMAIL' : 'PHONE',
      identifier: dto.identifier
    }
  }

  async extractProfileFromCode(req: Request, provider: string, code: string) {
    const providerInstance = this.providerService.findByService(provider)
    const profile = await providerInstance?.findUserByCode(code)

    const account = await this.prismaService.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: profile?.provider ?? '',
          providerAccountId: profile?.id ?? '' // Это ID из соцсети
        }
      }
    })

    let user = account?.userId ? await this.userService.findById(account.userId) : null

    if (!user && profile?.email) {
      user = await this.userService.findByEmail(profile.email)
    }

    if (user) {
      if (!account) {
        await this.prismaService.account.create({
          data: {
            userId: user.id,
            type: 'oauth',
            provider: profile?.provider ?? '',
            providerAccountId: profile?.id ?? '',
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
      profile?.email ?? null,
      null,
      profile?.name ?? '',
      null,
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
          providerAccountId: profile?.id ?? '', // <--- ДОБАВЬ ЭТУ СТРОКУ
          accessToken: profile?.access_token,
          refreshToken: profile?.refresh_token ?? null,
          expiresAt: profile?.expires_at ?? 0
        }
      })
    }

    return this.saveSession(req, user)
  }

  async login(req: Request, dto: LoginDto) {
    const user = dto.email
      ? await this.userService.findByEmail(dto.email)
      : dto.phone
        ? await this.userService.findByPhone(dto.phone)
        : null

    if (!user || !user.password) {
      throw new NotFoundException('Пользователь не найден. Пожалуйста, проверьте введенные данные.')
    }

    const isValidPassword = await verify(user.password, dto.password)

    if (!isValidPassword) {
      throw new UnauthorizedException(
        'Неверный пароль. Пожалуйста, попробуйте еще раз, или восстановите пароль, если забыли его.'
      )
    }

    if (!user.isVerified && user.email) {
      await this.emailConfirmationService.sendVerificationToken(user.email)
      throw new UnauthorizedException('Ваш email не подтвержден. Пожалуйста,проверьте вашу почту и подтвердите адрес.')
    }

    if (user.isTwoFactorEnabled && user.email) {
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

        res.clearCookie(this.configService.getOrThrow<string>('SESSION_NAME'))
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
