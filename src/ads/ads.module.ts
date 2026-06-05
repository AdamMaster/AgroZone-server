import { Module } from '@nestjs/common'
import { AdsService } from './ads.service'
import { AdsController } from './ads.controller'
import { PrismaService } from '@/prisma/prisma.service'
import { UserModule } from '@/user/user.module'

@Module({
  imports: [UserModule],
  controllers: [AdsController],
  providers: [AdsService, PrismaService]
})
export class AdsModule {}
