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
import { AuthMethod, TokenType, UserRole } from '@/generated/prisma/enums'
import { User } from '@/generated/prisma/client'
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
import { normalizePhone } from '@/libs/common/utils/phone.util'
import { ZvonokService } from '@/libs/zvonok/zvonok.service'

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    private readonly providerService: ProviderService,
    private readonly emailConfirmationService: EmailConfirmationService,
    private readonly twoFactorAuthService: TwoFactorAuthService,
    private readonly zvonokService: ZvonokService
  ) {}

  async registerSmsStart(dto: SmsRegisterDto) {
    const phone = normalizePhone(dto.phone)

    const isExists = await this.userService.findByPhone(phone)

    if (isExists) {
      throw new ConflictException('Пользователь с таким номером телефона уже зарегистрирован.')
    }

    return this.sendSmsCode(phone)
  }

  async registerSmsComplete(req: Request, dto: SmsCompleteDto) {
    const phone = normalizePhone(dto.phone)
    const smsToken = await this.prismaService.token.findFirst({
      where: {
        phone: phone,
        token: dto.code,
        type: TokenType.SMS_VERIFICATION
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
      null,
      dto.password,
      dto.name,
      phone,
      '',
      AuthMethod.CREDENTIALS,
      true,
      dto.personalDataConsent
    )

    await this.prismaService.token.delete({ where: { id: smsToken.id } })

    return this.saveSession(req, newUser)
  }

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Укажите Email или номер телефона для регистрации')
    }

    const phone = dto.phone ? normalizePhone(dto.phone) : null

    const emailExists = dto.email ? await this.userService.findByEmail(dto.email) : null

    const phoneExists = phone ? await this.userService.findByPhone(phone) : null

    if (emailExists || phoneExists) {
      throw new ConflictException('Пользователь с таким email или номером телефона уже существует.')
    }

    const newUser = await this.userService.create(
      dto.email ?? null,
      dto.password,
      dto.name,
      phone,
      '',
      AuthMethod.CREDENTIALS,
      false,
      dto.personalDataConsent
    )

    if (newUser.email) {
      await this.emailConfirmationService.sendVerificationToken(newUser.email)
      return { message: 'Пожалуйста, подтвердите ваш email.' }
    }

    if (newUser.phones.length) {
      await this.sendSmsCode(newUser.phones[0].phone)
      return { message: 'Код подтверждения отправлен на ваш телефон.' }
    }

    return {
      message:
        'Вы успешно зарегистрировались. Пожалуйста, подтвердите ваш email. Сообщение было отправлено на ваш почтовый адрес.'
    }
  }

  async sendSmsCode(phone: string, type: TokenType = TokenType.SMS_VERIFICATION) {
    // "Звонок на проверочный номер" — пользователь сам звонит на общий
    // номер zvonok, никакого кода нет вообще (см. ZvonokService). Вместо
    // кода в поле token храним call_id, который вернул zvonok — по нему
    // потом (в checkSmsCallbackStatus) опрашиваем, поступил ли звонок.
    // Токен сохраняем только после успешного ответа zvonok, иначе при
    // сбое в базе остался бы "код", о котором фронт никогда не узнает.
    const { callId, number } = await this.zvonokService.requestCallbackConfirmation(phone)

    // Удаляем старые коды для этого номера
    await this.prismaService.token.deleteMany({
      where: {
        phone,
        type
      }
    })

    const user = await this.userService.findByPhone(phone)

    await this.prismaService.token.create({
      data: {
        phone,
        token: callId,
        type,
        expiresIn: new Date(Date.now() + 5 * 60 * 1000),
        ...(user ? { user: { connect: { id: user.id } } } : {})
      }
    })

    return {
      message: `Позвоните с этого номера на ${number} — подтверждение придёт автоматически`,
      callNumber: number
    }
  }

  // Опрашивается с фронта, пока пользователь не позвонит на выданный
  // номер. Кода тут нет и сверять нечего — как только zvonok подтвердит,
  // что звонок с нужного номера поступил, отдаём фронту сам call_id
  // (в поле code) — фронт подставляет его в уже существующие ручки
  // подтверждения (verify-sms/register/sms/complete и т.д.), которые как
  // раз ищут токен по этому значению, так что их менять не пришлось.
  async checkSmsCallbackStatus(phone: string, type: TokenType = TokenType.SMS_VERIFICATION) {
    phone = normalizePhone(phone)

    const smsToken = await this.prismaService.token.findFirst({
      where: { phone, type }
    })

    if (!smsToken) {
      throw new BadRequestException('Код подтверждения не запрошен. Запросите новый.')
    }

    if (new Date() > smsToken.expiresIn) {
      await this.prismaService.token.delete({ where: { id: smsToken.id } })
      throw new BadRequestException('Время ожидания звонка истекло. Запросите новый код.')
    }

    const confirmed = await this.zvonokService.checkCallbackConfirmed(phone, smsToken.token)

    return confirmed ? { confirmed: true, code: smsToken.token } : { confirmed: false }
  }

  async sendPhoneChangeCode(phone: string, userId: string) {
    phone = normalizePhone(phone)

    const exists = await this.userService.findByPhone(phone)

    if (exists && exists.id !== userId) {
      throw new ConflictException('Этот номер уже используется.')
    }

    return this.sendSmsCode(phone, TokenType.PHONE_CHANGE)
  }

  async confirmPhoneChange(userId: string, phone: string, code: string) {
    phone = normalizePhone(phone)

    const token = await this.prismaService.token.findFirst({
      where: {
        phone,
        token: code,
        type: TokenType.PHONE_CHANGE
      }
    })

    if (!token) {
      throw new BadRequestException('Неверный код подтверждения')
    }

    if (new Date() > token.expiresIn) {
      await this.prismaService.token.delete({
        where: { id: token.id }
      })

      throw new BadRequestException('Срок действия кода истек')
    }

    const exists = await this.userService.findByPhone(phone)

    if (exists && exists.id !== userId) {
      throw new ConflictException('Этот номер уже используется.')
    }

    await this.prismaService.userPhone.deleteMany({
      where: {
        userId
      }
    })

    await this.prismaService.userPhone.create({
      data: {
        phone,
        userId,
        isPrimary: true,
        isVerified: true
      }
    })

    await this.prismaService.token.delete({
      where: {
        id: token.id
      }
    })

    return {
      success: true
    }
  }

  async verifySms(req: Request, dto: VerifySmsDto) {
    const phone = normalizePhone(dto.phone)

    const smsToken = await this.prismaService.token.findFirst({
      where: {
        phone,
        token: dto.code,
        type: TokenType.SMS_VERIFICATION
      }
    })

    if (!smsToken) {
      throw new BadRequestException('Неверный код подтверждения или номер телефона')
    }

    if (new Date() > smsToken.expiresIn) {
      await this.prismaService.token.delete({ where: { id: smsToken.id } })
      throw new BadRequestException('Срок действия кода истек. Запросите новый.')
    }

    const user = await this.userService.findByPhone(phone)

    if (!user) {
      throw new NotFoundException('Пользователь с таким номером не найден')
    }

    await this.prismaService.user.update({
      where: { id: user.id },
      data: { isVerified: true }
    })

    await this.prismaService.token.delete({ where: { id: smsToken.id } })

    return this.saveSession(req, user)
  }

  async checkRegisterCode(dto: { phone: string; code: string }) {
    const phone = normalizePhone(dto.phone)

    const smsToken = await this.prismaService.token.findFirst({
      where: {
        phone,
        token: dto.code,
        type: TokenType.SMS_VERIFICATION
      }
    })

    if (!smsToken) {
      throw new BadRequestException('Неверный код подтверждения')
    }

    if (new Date() > smsToken.expiresIn) {
      await this.prismaService.token.delete({ where: { id: smsToken.id } })
      throw new BadRequestException('Срок действия кода истек. Запросите новый.')
    }

    return { success: true }
  }

  async checkUser(dto: { identifier: string }) {
    const isEmail = dto.identifier.includes('@')
    let user: User | null = null

    if (isEmail) {
      user = await this.userService.findByEmail(dto.identifier)
    } else {
      const phone = normalizePhone(dto.identifier)
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

    // Согласие на обработку персональных данных для OAuth-регистрации не
    // оформляется отдельным чекбоксом (тут нет формы — сразу редирект на
    // Google/Яндекс), а подразумевается уведомлением рядом с кнопками входа
    // через соцсети на форме регистрации (см. AuthFormWrapper/AuthSocials).
    user = await this.userService.create(
      profile?.email ?? null,
      null,
      profile?.name ?? '',
      null,
      profile?.picture ?? '',
      method,
      true,
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
    const isEmail = dto.login.includes('@')
    let user: User | null = null

    if (isEmail) {
      user = await this.userService.findByEmail(dto.login)
    } else {
      const phone = normalizePhone(dto.login)

      user = await this.userService.findByPhone(phone)
    }

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
      throw new UnauthorizedException('Ваш email не подтвержден. Пожалуйста, проверьте вашу почту и подтвердите адрес.')
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

  // saveSession — единственная точка, через которую проходит вход/регистрация
  // независимо от способа (пароль, SMS, Google, Yandex — см. все вызовы
  // this.saveSession выше), поэтому это самое надёжное место для
  // автоповышения роли: сработает при любом способе входа, без дублирования
  // проверки в каждом методе отдельно.
  async saveSession(req: Request, user: User) {
    const role = await this.ensureAdminRole(user)
    const sessionUser = role === user.role ? user : { ...user, role }

    return new Promise((resolve, reject) => {
      req.session.userId = user.id
      req.session.userRole = role

      req.session.save(err => {
        if (err) {
          console.error('SESSION SAVE ERROR:', err)
          return reject(
            new InternalServerErrorException(
              'Не удалось сохранить сессию. Проверьте правильно ли настроены параметры сессии.'
            )
          )
        }

        resolve({ user: sessionUser })
      })
    })
  }

  // Автоповышение до ADMIN по списку почт из переменной окружения
  // ADMIN_EMAILS (через запятую) — решает проблему курицы и яйца: самого
  // первого админа неоткуда назначить через интерфейс, потому что сам
  // интерфейс администрирования будет защищён ролью ADMIN, которой ни у кого
  // ещё нет. Достаточно один раз прописать свою почту в ADMIN_EMAILS на
  // сервере — при следующем входе роль проставится сама, без ручных правок в
  // БД. Дальше, когда в админке появится управление пользователями, НОВЫХ
  // админов уже можно будет назначать через интерфейс, а не через .env.
  private async ensureAdminRole(user: User): Promise<UserRole> {
    if (user.role === UserRole.ADMIN || !user.email) {
      return user.role
    }

    const adminEmails = (this.configService.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean)

    if (!adminEmails.includes(user.email.toLowerCase())) {
      return user.role
    }

    const updated = await this.prismaService.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN }
    })

    return updated.role
  }
}
