import { Module } from '@nestjs/common'

import { AuthModule } from '@/auth/auth.module'
import { PrismaService } from '@/prisma/prisma.service'
import { UserModule } from '@/user/user.module'

import { BlockedUsersController } from './blocked-users.controller'
import { BlockedUsersService } from './blocked-users.service'

@Module({
  imports: [UserModule, AuthModule],
  controllers: [BlockedUsersController],
  providers: [BlockedUsersService, PrismaService],
  // Экспортируем сервис — ConversationsService нужно проверять isBlocked
  // перед стартом диалога и перед отправкой сообщения.
  exports: [BlockedUsersService]
})
export class BlockedUsersModule {}
