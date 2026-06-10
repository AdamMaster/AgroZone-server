import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    // Забираем всё дерево целиком.
    // Если уровней может быть много, лучше использовать рекурсию,
    // но для начала хватит и глубокого include.
    return this.prisma.category.findMany({
      where: { parentId: null },
      include: {
        children: {
          include: {
            children: {
              include: {
                children: {
                  include: { children: true }
                }
              }
            }
          }
        }
      }
    })
  }
}
