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

@Injectable()
export class AuthService {
  constructor(
    readonly userService: UserService,
    readonly confiService: ConfigService
  ) {}

  async register(req: Request, dto: RegisterDto) {
    const isExists = await this.userService.findByEmail(dto.email)

    if (isExists) {
      throw new ConflictException(
        'Регистрация не удалась. Пользователь с таким email уже существует. Пожалуйста, используйте другой email, или войдите в систему.'
      )
    }

    const newUser = await this.userService.create(dto.email, dto.password, dto.name, '', AuthMethod.CREDENTIALS, false)

    return this.saveSession(req, newUser)
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
