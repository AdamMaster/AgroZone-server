import { MailService } from '@/libs/mail/mail.service'
import { PrismaService } from '@/prisma/prisma.service'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { TokenType } from '@/generated/prisma/enums'
import { generateNumericCode } from '@/libs/common/utils/generate-code.util'

@Injectable()
export class TwoFactorAuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly mailService: MailService
  ) {}

  async validateTwoFactorToken(email: string, code: string) {
    const existingToken = await this.prismaService.token.findFirst({
      where: {
        email,
        type: TokenType.TWO_FACTOR
      }
    })

    if (!existingToken) {
      throw new NotFoundException(
        'Токен двухфакторной аутентификации не найден. Убедитесь, что вы запрашивали токен для данного адреса электронной почты.'
      )
    }

    if (existingToken.token !== code) {
      throw new BadRequestException(
        'Неверный код двухфакторной аутентификации. Пожалуйста, проверьте введенный код и попробуйте снова.'
      )
    }

    const hasExpired = new Date(existingToken.expiresIn) < new Date()

    if (hasExpired) {
      throw new BadRequestException(
        'Срок действия токена двухфакторной аутентификации истек. Пожалуйста, запросите нновый токен.'
      )
    }

    await this.prismaService.token.delete({
      where: {
        id: existingToken.id,
        type: TokenType.TWO_FACTOR
      }
    })

    return true
  }

  async sendTwoFactorToken(email: string) {
    const twoFactorToken = await this.generateTwoFactorToken(email)

    if (!twoFactorToken.email) {
      throw new BadRequestException('Не удалось отправить код: email не найден.')
    }

    await this.mailService.sendTwoFactorTokenEmail(twoFactorToken.email, twoFactorToken.token)

    return true
  }

  private async generateTwoFactorToken(email: string) {
    const token = generateNumericCode()
    const expiresIn = new Date(new Date().getTime() + 300000)

    const existingToken = await this.prismaService.token.findFirst({
      where: {
        email,
        type: TokenType.TWO_FACTOR
      }
    })

    if (existingToken) {
      await this.prismaService.token.delete({
        where: {
          id: existingToken.id,
          type: TokenType.TWO_FACTOR
        }
      })
    }

    const twoFactoToken = await this.prismaService.token.create({
      data: {
        email,
        token,
        expiresIn,
        type: TokenType.TWO_FACTOR
      }
    })

    return twoFactoToken
  }
}
