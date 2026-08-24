import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { verify } from 'argon2' // Используем verify для пароля
import { v4 as uuidv4 } from 'uuid'
import { MailService } from '@/libs/mail/mail.service'
import { PrismaService } from '@/prisma/prisma.service'
import { UserService } from '@/user/user.service'
import { TokenType } from '@/generated/prisma/enums'
import { ChangeEmailDto } from './dto/email-change.dto'

@Injectable()
export class EmailChangeService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userService: UserService,
    private readonly mailService: MailService
  ) {}

  async requestEmailChange(userId: string, dto: ChangeEmailDto) {
    const user = await this.userService.findById(userId)
    if (!user) {
      throw new NotFoundException('Пользователь не найден')
    }

    if (!user.password) {
      throw new BadRequestException('Для этого аккаунта пароль не установлен. Попробуйте войти через соцсети.')
    }

    const isPasswordCorrect = await verify(user.password, dto.password)
    if (!isPasswordCorrect) {
      throw new BadRequestException('Неверный текущий пароль')
    }

    const isEmailTaken = await this.userService.findByEmail(dto.newEmail)
    if (isEmailTaken) {
      throw new BadRequestException('Этот адрес электронной почты уже используется')
    }

    const token = uuidv4()
    const expiresIn = new Date(new Date().getTime() + 3600 * 1000)

    await this.prismaService.token.deleteMany({
      where: {
        userId,
        type: TokenType.EMAIL_CHANGE
      }
    })

    await this.prismaService.token.create({
      data: {
        token,
        expiresIn,
        type: TokenType.EMAIL_CHANGE,
        email: dto.newEmail,
        userId
      }
    })

    await this.mailService.sendEmailChange(dto.newEmail, token)

    return true
  }

  async confirmEmailChange(token: string) {
    const existingToken = await this.prismaService.token.findFirst({
      where: {
        token,
        type: TokenType.EMAIL_CHANGE
      }
    })

    // Фикс ошибки: Проверяем, что токен существует и у него есть userId
    if (!existingToken || !existingToken.userId) {
      throw new NotFoundException('Ссылка устарела или недействительна')
    }

    const hasExpired = new Date(existingToken.expiresIn) < new Date()
    if (hasExpired) {
      throw new BadRequestException('Срок действия ссылки истек')
    }

    // Теперь TypeScript спокоен, так как мы проверили !existingToken.userId выше
    await this.prismaService.user.update({
      where: { id: existingToken.userId },
      data: {
        email: existingToken.email,
        isVerified: true // Считаем почту подтвержденной после смены
      }
    })

    await this.prismaService.token.delete({
      where: { id: existingToken.id }
    })

    return true
  }
}
