import { Module } from '@nestjs/common'
import { AdsService } from './ads.service'
import { AdsController } from './ads.controller'
import { PrismaService } from '@/prisma/prisma.service'
import { UserModule } from '@/user/user.module'
import { FileModule } from '../file/file.module'

@Module({
  imports: [UserModule, FileModule],
  controllers: [AdsController],
  providers: [AdsService, PrismaService]
})
export class AdsModule {}
