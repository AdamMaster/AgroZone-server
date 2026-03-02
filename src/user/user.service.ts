import { PrismaService } from '@/prisma/prisma.service'
import { Injectable, NotFoundException } from '@nestjs/common'
import { hash } from 'argon2'
import { AuthMethod } from 'prisma/generated/enums'

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
    email: string,
    password: string,
    displayName: string,
    picture: string,
    method: AuthMethod,
    isVerified: boolean
  ) {
    const user = await this.prismaService.user.create({
      data: {
        email,
        password: password ? await hash(password) : '',
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
}
