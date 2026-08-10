import { PrismaService } from '@/prisma/prisma.service'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { hash, verify } from 'argon2'
import { AdStatus, AuthMethod, TokenType, UserRole } from 'prisma/generated/enums'
import { UpdateUserDto } from './dto/update-user.dto'
import { PasswordChangeDto } from './dto/password-change.dto'
import { DeleteAccountDto } from './dto/delete-account.dto'
import { ConfigService } from '@nestjs/config'
import { FileService } from '../file/file.service'
import { AD_LIMITS } from '@/ads/constants/ads.constants'
import { isPremiumActive } from '@/premium/utils/is-premium-active.util'
import { normalizePhone } from '@/libs/common/utils/phone.util'
import { generateSmsCode } from '@/libs/common/utils/generate-code.util'

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

    // Есть номер, но ни один не помечен isPrimary — раньше могло возникать
    // из-за confirmAddPhone(makePrimary=false) при добавлении номера прямо
    // из формы объявления (см. AdsService/ad-form.tsx), это уже
    // исправлено там, но у пользователей, добавивших номер ДО фикса,
    // состояние в БД так и осталось. Подстраховываемся и здесь — тот же
    // приём, что уже используется в AdsService.saveDraft: если основного
    // нет, но номера есть, считаем основным первый, а не оставляем null.
    const primaryPhone = user.phones.find(phone => phone.isPrimary)?.phone ?? user.phones[0]?.phone ?? null

    return {
      ...user,
      primaryPhone,
      // Раньше сверялись с role === 'PREMIUM' — устарело, см. тот же
      // комментарий в AdsService.validateFileLimits.
      maxUploadLimit: isPremiumActive(user.premiumUntil) ? AD_LIMITS.PREMIUM : AD_LIMITS.REGULAR
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

    const smsCode = generateSmsCode()

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

  async confirmAddPhone(userId: string, smsCode: string, makePrimary = false) {
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
      const existingPhonesCount = await tx.userPhone.count({ where: { userId } })

      // Самый первый номер аккаунта всегда становится основным, даже если
      // вызывающий код явно не просил makePrimary (например, добавление
      // номера прямо из формы объявления — см. FormAddPhone/ad-form.tsx,
      // там makePrimary не передаётся). Без этого пользователь, добавивший
      // номер таким способом, оставался без primaryPhone — из-за этого при
      // создании СЛЕДУЮЩЕГО объявления номер не подставлялся автоматически,
      // будто его и не добавляли, и приходилось каждый раз вводить заново.
      // Если у пользователя уже есть номер(а), ведём себя как раньше — не
      // переключаем основной без явного makePrimary.
      const shouldBePrimary = makePrimary || existingPhonesCount === 0

      if (shouldBePrimary) {
        await tx.userPhone.updateMany({
          where: { userId, isPrimary: true },
          data: { isPrimary: false }
        })
      }

      await tx.userPhone.create({
        data: {
          phone,
          userId,
          isPrimary: shouldBePrimary,
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

  // Переключить основной номер аккаунта на уже добавленный и подтверждённый
  // номер — без повторного SMS-подтверждения, так как номер уже верифицирован.
  async setPrimaryPhone(userId: string, phone: string) {
    const normalizedPhone = normalizePhone(phone)

    const userPhone = await this.prismaService.userPhone.findFirst({
      where: { userId, phone: normalizedPhone }
    })

    if (!userPhone) {
      throw new NotFoundException('Этот номер телефона не найден в вашем аккаунте')
    }

    if (!userPhone.isVerified) {
      throw new BadRequestException('Номер телефона должен быть подтверждён')
    }

    if (userPhone.isPrimary) {
      return { success: true, message: 'Этот номер уже является основным' }
    }

    await this.prismaService.$transaction(async tx => {
      await tx.userPhone.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false }
      })

      await tx.userPhone.update({
        where: { id: userPhone.id },
        data: { isPrimary: true }
      })
    })

    return { success: true, message: 'Основной номер изменён' }
  }

  // Удаление аккаунта — мягкое: строка User не удаляется физически, а
  // обезличивается (deletedAt проставляется, персональные поля обнуляются).
  // Причина — Conversation каскадно завязан и на buyerId, и на sellerId
  // (см. schema.prisma): физическое удаление пользователя снесло бы
  // переписку целиком, включая сообщения второй стороны, которая ничего не
  // удаляла. Объявления по той же логике не удаляются физически прямо
  // сейчас — переводятся в ARCHIVED, дальше их подчищает
  // AdsArchivePurgeWorker (для удалённого аккаунта — без задержки, при
  // следующей ночной чистке). Переписка от судьбы объявления больше не
  // зависит (Conversation.adId — SetNull, не Cascade) и живёт, пока жив хотя
  // бы один из двух её участников — см. шаг с orphanConversationIds ниже.
  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.findById(userId)

    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException(
        'Аккаунт администратора нельзя удалить самостоятельно — обратитесь к разработчику.'
      )
    }

    if (user.password) {
      if (!dto.password) {
        throw new BadRequestException('Необходимо указать пароль для подтверждения')
      }

      const isValidPassword = await verify(user.password, dto.password)
      if (!isValidPassword) {
        throw new BadRequestException('Неверный пароль')
      }
    }

    // Аватарку из S3 удаляем до транзакции — если это упадёт, лучше
    // прервать удаление с понятной ошибкой, чем обезличить аккаунт с
    // "осиротевшим" файлом в хранилище, о котором больше негде узнать.
    if (user.picture) {
      await this.fileService.deleteFileByUrl(user.picture)
    }

    await this.prismaService.$transaction(async tx => {
      // Чисто персональные данные — ни на кого больше не ссылаются, можно
      // удалить физически.
      await tx.userPhone.deleteMany({ where: { userId } })
      await tx.account.deleteMany({ where: { userId } })
      await tx.token.deleteMany({ where: { userId } })
      await tx.favorite.deleteMany({ where: { userId } })
      await tx.notification.deleteMany({ where: { userId } })

      // Объявления — не удаляем (см. комментарий к методу), просто прячем
      // из каталога переводом в архив.
      await tx.ad.updateMany({
        where: { userId, status: { not: AdStatus.ARCHIVED } },
        data: { status: AdStatus.ARCHIVED, archivedAt: new Date() }
      })

      // Диалоги этого юзера, где собеседник уже тоже удалил свой аккаунт
      // раньше — теперь, когда уходит и этот участник, диалог гарантированно
      // бесхозный: залогиниться в него не сможет уже ни один из двух (см.
      // AuthGuard). Такие удаляем физически сразу (Message каскадом уйдёт
      // вместе с Conversation — Message.conversation остался на Cascade, это
      // ок, оба владельца этих сообщений уже ушли). Диалоги, где собеседник
      // ещё жив, не трогаем — это его личная история переписки.
      const conversations = await tx.conversation.findMany({
        where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
        select: {
          id: true,
          buyerId: true,
          buyer: { select: { deletedAt: true } },
          seller: { select: { deletedAt: true } }
        }
      })

      const orphanConversationIds = conversations
        .filter(conversation => {
          const counterpart = conversation.buyerId === userId ? conversation.seller : conversation.buyer
          return counterpart.deletedAt !== null
        })
        .map(conversation => conversation.id)

      if (orphanConversationIds.length) {
        await tx.conversation.deleteMany({ where: { id: { in: orphanConversationIds } } })
      }

      // Сам аккаунт — обезличиваем и помечаем deletedAt. Оставшиеся (не
      // бесхозные) Conversation/Message, а также AdReport, PremiumPurchase,
      // AdBump, AdServicePurchase не трогаем — они продолжают ссылаться на
      // этот userId, просто теперь это анонимный пользователь. В чате
      // собеседник увидит явную подпись "Пользователь удалил аккаунт" по
      // deletedAt (см. ChatHeader/ConversationListItem на клиенте) — не
      // просто пустое имя, как раньше.
      await tx.user.update({
        where: { id: userId },
        data: {
          email: null,
          password: null,
          displayName: null,
          picture: null,
          bio: null,
          location: null,
          isTwoFactorEnabled: false,
          deletedAt: new Date()
        }
      })
    })

    return { success: true }
  }
}
