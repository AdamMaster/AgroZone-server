import { Module } from '@nestjs/common'
import { CategoriesService } from './categories.service'
import { CategoriesController } from './categories.controller'
import { PrismaService } from '@/prisma/prisma.service'
import { EmbeddingsModule } from '@/libs/embeddings/embeddings.module'

@Module({
  imports: [EmbeddingsModule],
  controllers: [CategoriesController],
  providers: [CategoriesService, PrismaService],
  exports: [CategoriesService]
})
export class CategoriesModule {}
