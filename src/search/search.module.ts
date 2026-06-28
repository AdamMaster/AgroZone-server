import { Module } from '@nestjs/common'
import { SearchController } from './search.controller'
import { SearchService } from './search.service'
import { PrismaService } from '../prisma/prisma.service'
import { PrismaModule } from '@/prisma/prisma.module'
import { RedisModule } from '@/redis/redis.module'
import { CategoriesModule } from '@/categories/categories.module'

@Module({
  imports: [PrismaModule, RedisModule, CategoriesModule],
  controllers: [SearchController],
  providers: [SearchService]
})
export class SearchModule {}
