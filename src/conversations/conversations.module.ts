import { Module } from '@nestjs/common'

import { AuthModule } from '@/auth/auth.module'
import { BlockedUsersModule } from '@/blocked-users/blocked-users.module'
import { PrismaService } from '@/prisma/prisma.service'
import { UserModule } from '@/user/user.module'

import { ConversationsController } from './conversations.controller'
import { ConversationsService } from './conversations.service'

@Module({
  imports: [UserModule, AuthModule, BlockedUsersModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, PrismaService]
})
export class ConversationsModule {}
