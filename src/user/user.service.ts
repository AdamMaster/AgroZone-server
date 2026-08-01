import { PrismaService } from '@/prisma/prisma.service'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { hash, verify } from 'argon2'
import { AuthMethod, TokenType } from 'prisma/generated/enums'
import { UpdateUserDto } from './dto/update-user.dto'
import { PasswordChangeDto } from './dto/password-change.dto'
import { ConfigService } from '@nestjs/config'
import { FileService } from '../file/file.service'
import { AD_LIMITS } from '@/ads/constants/ads.constants'
import { normalizePhone } from '@/libs/common/utils/phone.util'

@Injectable()
export class UserService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly fileService: FileService,
    private readonly configService: ConfigService
  ) {}

  async findById(id: string) {
    const user = await this.prismaService.user.findUnique({
      where: {
        id
      },
      include: {
        accounts: true,
        phones: true
      }
    })

    if (!user) {
      throw new NotFoundException('Пользователь не найден. Пожалуйста, проверьте введенные данные.')
    }

    return user
  }

  async getProfileForClient(userId: string) {
    const user = await this.findById(userId)

    const primaryPhone = user.phones.find(phone => phone.isPrimary)?.phone ?? null

    return {
      ...user,
      primaryPhone,
      maxUploadLimit: user.role === 'PREMIUM' ? AD_LIMITS.PREMIUM : AD_LIMITS.REGULAR
    }
  }

  async findByPhone(phone: string) {
    const userPhone = await this.prismaService.userPhone.findUnique({
      where: {
        phone
      },
      include: {
        user: {
          include: {
            accounts: true,
            phones: true
          }
        }
      }
    })

    return userPhone?.user ?? null
  }

  async findByEmail(email: string) {
    const user = await this.prismaService.user.findUnique({
      where: {
        email
      },
      include: {
        accounts: true,
        phones: true
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
    const normalizedPhone = phone ? normalizePhone(phone) : null

    const user = await this.prismaService.user.create({
      data: {
        email,
        password: password ? await hash(password) : null,
        displayName,
        picture,
        method,
        isVerified,

        ...(normalizedPhone && {
          phones: {
            create: {
              phone: normalizedPhone,
              isPrimary: true,
              isVerified
            }
          }
        })
      },
      include: {
        accounts: true,
        phones: true
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
        displayName: dto.name
      }
    })

    return updatedUser
  }

  async updateAvatar(userId: string, fileName: string) {
    const user = await this.findById(userId)

    // 2. Если у пользователя уже была старая аватарка, удаляем её из S3
    if (user && user.picture) {
      try {
        const bucketName = this.configService.getOrThrow<string>('S3_BUCKET_NAME')
        const fileId = user.picture.split(`${bucketName}/`)[1]

        if (fileId) {
          await this.fileService.deleteFile(fileId)
        }
      } catch (error) {
        console.error('Не удалось удалить старую аватарку из S3:', error)
      }
    }

    // 3. Обновляем поле picture новой ссылкой
    return this.prismaService.user.update({
      where: {
        id: userId
      },
      data: {
        picture: fileName // Сюда прилетит uploadResult.url из контроллера
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

    if (!user.isVerified) {
      throw new BadRequestException('Сначала подтвердите аккаунт')
    }

    return this.prismaService.user.update({
      where: { id: userId },
      data: {
        isTwoFactorEnabled: !user.isTwoFactorEnabled
      }
    })
  }

  async requestPhoneChange(userId: string, newPhone: string) {
    newPhone = normalizePhone(newPhone)

    const exists = await this.prismaService.userPhone.findUnique({
      where: {
        phone: newPhone
      }
    })

    if (exists) {
      if (exists.userId === userId) {
        throw new BadRequestException('Этот номер уже добавлен в ваш аккаунт')
      }

      throw new BadRequestException('Этот номер уже используется другим аккаунтом')
    }

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
        type: TokenType.PHONE_CHANGE
      }
    })

    if (!tokenRecord || new Date() > tokenRecord.expiresIn) {
      throw new BadRequestException('Неверный код или срок его действия истек')
    }

    if (!tokenRecord.phone) {
      throw new BadRequestException('Номер телефона отсутствует')
    }

    const phone = tokenRecord.phone

    const phoneExists = await this.prismaService.userPhone.findUnique({
      where: {
        phone
      }
    })

    if (phoneExists) {
      if (phoneExists.userId !== userId) {
        throw new BadRequestException('Этот номер телефона уже используется другим аккаунтом')
      }

      await this.prismaService.$transaction(async tx => {
        await tx.userPhone.updateMany({
          where: {
            userId,
            isPrimary: true
          },
          data: {
            isPrimary: false
          }
        })

        await tx.userPhone.update({
          where: {
            id: phoneExists.id
          },
          data: {
            isPrimary: true,
            isVerified: true
          }
        })

        await tx.token.delete({
          where: {
            id: tokenRecord.id
          }
        })
      })

      return {
        success: true,
        message: 'Основной номер изменен'
      }
    }

    await this.prismaService.$transaction(async tx => {
      await tx.userPhone.updateMany({
        where: {
          userId,
          isPrimary: true
        },
        data: {
          isPrimary: false
        }
      })

      await tx.userPhone.create({
        data: {
          phone,
          userId,
          isPrimary: true,
          isVerified: true
        }
      })

      await tx.token.delete({
        where: {
          id: tokenRecord.id
        }
      })
    })

    return {
      success: true,
      message: 'Номер телефона успешно изменен'
    }
  }

  async confirmAddPhone(userId: string, smsCode: string) {
    const tokenRecord = await this.prismaService.token.findFirst({
      where: {
        token: smsCode,
        userId,
        type: TokenType.PHONE_CHANGE
      }
    })

    if (!tokenRecord || new Date() > tokenRecord.expiresIn) {
      throw new BadRequestException('Неверный код или срок его действия истек')
    }

    if (!tokenRecord.phone) {
      throw new BadRequestException('Номер телефона отсутствует')
    }

    const phone = normalizePhone(tokenRecord.phone)

    const exists = await this.prismaService.userPhone.findUnique({
      where: {
        phone
      }
    })

    if (exists) {
      if (exists.userId === userId) {
        throw new BadRequestException('Этот номер уже добавлен в ваш аккаунт')
      }

      throw new BadRequestException('Этот номер уже используется другим аккаунтом')
    }

    await this.prismaService.$transaction(async tx => {
      await tx.userPhone.create({
        data: {
          phone,
          userId,
          isPrimary: false,
          isVerified: true
        }
      })

      await tx.token.delete({
        where: {
          id: tokenRecord.id
        }
      })
    })

    return {
      success: true,
      phone
    }
  }
}
