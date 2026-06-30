import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'

export interface CategoryWithChildren {
  id: string
  name: string
  slug: string
  code: string
  iconId: string | null
  parentId: string | null
  level: number
  sortOrder: number
  children: CategoryWithChildren[]
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<CategoryWithChildren[]> {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    })

    const byParent = new Map<string, typeof categories>()

    const key = (parentId: string | null) => parentId ?? 'root'

    for (const cat of categories) {
      const k = key(cat.parentId)

      if (!byParent.has(k)) {
        byParent.set(k, [])
      }

      byParent.get(k)!.push(cat)
    }

    const build = (parentId: string | null): CategoryWithChildren[] => {
      const children = byParent.get(key(parentId)) ?? []

      return children.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        code: cat.code,
        iconId: cat.iconId,
        parentId: cat.parentId,
        level: cat.level,
        sortOrder: cat.sortOrder,
        availableFeatures: cat.availableFeatures,
        path: cat.path,
        fullPath: cat.fullPath,
        children: build(cat.id)
      }))
    }

    return build(null)
  }

  async getCategoryPath(categoryId: string): Promise<string[]> {
    const path: string[] = []

    let current = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { slug: true, parentId: true }
    })

    while (current) {
      path.unshift(current.slug)

      if (!current.parentId) break

      current = await this.prisma.category.findUnique({
        where: { id: current.parentId },
        select: { slug: true, parentId: true }
      })
    }

    return path
  }

  buildSeoPath(categoryPath: string[], slug: string): string {
    return [...categoryPath, slug].join('/')
  }
}
