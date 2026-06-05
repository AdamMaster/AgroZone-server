import { PrismaService } from '@/prisma/prisma.service'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { hash, verify } from 'argon2'
import { AuthMethod } from 'prisma/generated/enums'
import { UpdateUserDto } from './dto/update-user.dto'
import { PasswordChangeDto } from './dto/password-change.dto'

@Injectable()
export class UserService {
  constructor(private readonly prismaService: PrismaService) {}

  async findById(id: string) {
    const user = await this.prismaService.user.findUnique({
      where: {
        id
      },
      include: {
        accounts: true
      }
    })

    if (!user) {
      throw new NotFoundException('Пользователь не найден. Пожалуйста, проверьте введенные данные.')
    }

    return user
  }

  async findByPhone(phone: string) {
    const user = await this.prismaService.user.findUnique({
      where: {
        phone
      },
      include: {
        accounts: true
      }
    })

    return user
  }

  async findByEmail(email: string) {
    const user = await this.prismaService.user.findUnique({
      where: {
        email
      },
      include: {
        accounts: true
      }
    })

    return user
  }

  async create(
    email: string | null,
    password: string | null,
    displayName: string,
    phone: string | null,
    picture: string,
    method: AuthMethod,
    isVerified: boolean
  ) {
    const user = await this.prismaService.user.create({
      data: {
        phone,
        email,
        password: password ? await hash(password) : null,
        displayName,
        picture,
        method,
        isVerified
      },
      include: {
        accounts: true
      }
    })

    return user
  }

  async update(userId: string, dto: UpdateUserDto) {
    const user = await this.findById(userId)

    const updatedUser = await this.prismaService.user.update({
      where: {
        id: user.id
      },
      data: {
        email: dto.email,
        displayName: dto.name,
        phone: dto.phone,
        isTwoFactorEnabled: dto.isTwoFactorEnabled
      }
    })

    return updatedUser
  }

  async updateAvatar(userId: string, fileName: string) {
    await this.findById(userId)

    return this.prismaService.user.update({
      where: {
        id: userId
      },
      data: {
        picture: fileName
      }
    })
  }

  async updatePassword(userId: string, dto: PasswordChangeDto) {
    const user = await this.findById(userId)

    if (user.password) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Необходимо указать текущий пароль')
      }

      const isValidPassword = await verify(user.password, dto.currentPassword)
      if (!isValidPassword) {
        throw new BadRequestException('Текущий пароль указан неверно')
      }
    }

    return this.prismaService.user.update({
      where: { id: userId },
      data: {
        password: await hash(dto.newPassword)
      }
    })
  }

  async toggleTwoFactor(userId: string) {
    const user = await this.findById(userId)

    if (!user.isVerified && !user.isTwoFactorEnabled) {
      throw new BadRequestException('Сначала подтвердите почту')
    }

    return this.prismaService.user.update({
      where: { id: userId },
      data: {
        isTwoFactorEnabled: !user.isTwoFactorEnabled
      }
    })
  }

  async requestPhoneChange(userId: string, newPhone: string) {
    // Проверяем занятость номера
    const exists = await this.prismaService.user.findUnique({ where: { phone: newPhone } })
    if (exists) throw new BadRequestException('Номер уже занят')

    const smsCode = Math.floor(1000 + Math.random() * 9000).toString()

    await this.prismaService.token.deleteMany({ where: { userId, type: 'PHONE_CHANGE' } })
    await this.prismaService.token.create({
      data: {
        token: smsCode,
        expiresIn: new Date(Date.now() + 5 * 60 * 1000),
        type: 'PHONE_CHANGE',
        userId,
        phone: newPhone
      }
    })

    console.log(`[СМС] Код: ${smsCode}`) // Сюда потом прикрутишь отправку
    return { success: true }
  }

  async confirmPhoneChange(userId: string, smsCode: string) {
    const tokenRecord = await this.prismaService.token.findFirst({
      where: {
        token: smsCode,
        userId,
        type: 'PHONE_CHANGE'
      }
    })

    // 2. Проверяем, существует ли он и не протух ли по времени
    if (!tokenRecord || new Date() > tokenRecord.expiresIn) {
      throw new BadRequestException('Неверный код или срок его действия истек')
    }

    const phoneExists = await this.prismaService.user.findUnique({
      where: { phone: tokenRecord.phone! }
    })
    if (phoneExists && phoneExists.id !== userId) {
      throw new BadRequestException('Этот номер телефона уже используется другим аккаунтом')
    }

    await this.prismaService.user.update({
      where: { id: userId },
      data: { phone: tokenRecord.phone }
    })

    await this.prismaService.token.delete({
      where: { id: tokenRecord.id }
    })

    return { success: true, message: 'Номер телефона успешно изменен' }
  }
}
