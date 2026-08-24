import { UserService } from './../../user/user.service'
import { PrismaService } from '@/prisma/prisma.service'
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { Request } from 'express'
import { TokenType } from '@/generated/prisma/enums'
import { v4 as uuidv4 } from 'uuid'
import { ConfirmationDto } from './dto/confirmation.dto'
import { User } from '@/generated/prisma/client'
import { MailService } from '@/libs/mail/mail.service'
import { AuthService } from '../auth.service'

@Injectable()
export class EmailConfirmationService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly mailService: MailService,
    private readonly userService: UserService,
    // AuthService сюда не инжектим через конструктор — это замыкает
    // циклическую зависимость (AuthService тоже импортирует
    // EmailConfirmationService), и SWC, в отличие от tsc, не подставляет
    // безопасную проверку в decorator-метаданные параметра конструктора,
    // из-за чего при циклической загрузке модулей падает
    // "Cannot access 'AuthService' before initialization". ModuleRef
    // достаёт сервис лениво, в момент вызова метода, когда все модули уже
    // точно загружены — это официальный способ Nest обходить такие циклы.
    private readonly moduleRef: ModuleRef
  ) {}

  async newVirification(req: Request, dto: ConfirmationDto) {
    const existingToken = await this.prismaService.token.findFirst({
      where: {
        token: dto.token,
        type: TokenType.VERIFICATION
      }
    })

    if (!existingToken) {
      throw new NotFoundException('Токен подтверждения не найден. Пожалуйста, убедитесь, что у вас правильный токен.')
    }

    const hasExpired = new Date(existingToken.expiresIn) < new Date()

    if (hasExpired) {
      throw new BadRequestException('Токен подтверждения истек. Пожалуйста, запросите новый токен для подтвержденияю')
    }

    if (!existingToken.email) {
      throw new InternalServerErrorException('Токен не содержит email адреса.')
    }

    const existingUser = await this.userService.findByEmail(existingToken.email)

    if (!existingUser) {
      throw new NotFoundException(
        'Пользователь не найден. Пожалуйста, проверьте введенный адрес электронной почты и попробуйте снова.'
      )
    }

    await this.prismaService.user.update({
      where: {
        id: existingUser.id
      },
      data: {
        isVerified: true
      }
    })

    await this.prismaService.token.delete({
      where: {
        id: existingToken.id,
        type: TokenType.VERIFICATION
      }
    })

    const authService = this.moduleRef.get(AuthService, { strict: false })

    return authService.saveSession(req, existingUser)
  }

  async sendVerificationToken(email: string) {
    const verificationToken = await this.generateVerificationToken(email)

    if (!verificationToken.email) {
      throw new InternalServerErrorException('Ошибка: Токен подтверждения был создан без привязки к email.')
    }

    await this.mailService.sendConfirmationEmail(verificationToken.email, verificationToken.token)

    return true
  }

  private async generateVerificationToken(email: string) {
    const token = uuidv4()
    const expiresIn = new Date(new Date().getTime() + 3600 * 1000)

    const existingToken = await this.prismaService.token.findFirst({
      where: {
        email,
        type: TokenType.VERIFICATION
      }
    })

    if (existingToken) {
      await this.prismaService.token.delete({
        where: {
          id: existingToken.id,
          type: TokenType.VERIFICATION
        }
      })
    }

    const verificationToken = await this.prismaService.token.create({
      data: {
        email,
        token,
        expiresIn,
        type: TokenType.VERIFICATION
      }
    })

    return verificationToken
  }
}
