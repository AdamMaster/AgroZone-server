import { Module } from '@nestjs/common'

import { AuthModule } from '@/auth/auth.module'
import { PrismaService } from '@/prisma/prisma.service'
import { UserModule } from '@/user/user.module'

import { AdReportsAdminController } from './ad-reports-admin.controller'
import { AdReportsController } from './ad-reports.controller'
import { AdReportsService } from './ad-reports.service'

@Module({
  imports: [UserModule, AuthModule],
  controllers: [AdReportsController, AdReportsAdminController],
  providers: [AdReportsService, PrismaService]
})
export class AdReportsModule {}
