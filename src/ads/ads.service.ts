import { Injectable } from '@nestjs/common'
import { CreateAdDto } from './dto/create-ad.dto'
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class AdsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAdDto: any, userId: string) {
    return this.prisma.ad.create({
      data: {
        ...createAdDto,
        userId: userId
      }
    })
  }

  async findAll(categoryId?: string) {
    return this.prisma.ad.findMany({
      where: {
        ...(categoryId ? { categoryId } : {})
      },
      include: {
        category: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
  }

  async findMyAds(userId: string) {
    return this.prisma.ad.findMany({
      where: {
        userId: userId
      }
    })
  }

  async findOne(id: string) {
    return this.prisma.ad.findUnique({
      where: { id },
      include: { category: true }
    })
  }

  async update(id: string, updateAdDto: any, userId: string) {
    return this.prisma.ad.updateMany({
      where: {
        id: id,
        userId: userId
      },
      data: updateAdDto
    })
  }

  async remove(id: string, userId: string) {
    return this.prisma.ad.deleteMany({
      where: {
        id: id,
        userId: userId
      }
    })
  }
}
