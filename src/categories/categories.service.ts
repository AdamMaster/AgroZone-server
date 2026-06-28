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
    const getKey = (parentId: string | null) => parentId ?? 'root'

    for (const cat of categories) {
      const key = getKey(cat.parentId)
      if (!byParent.has(key)) {
        byParent.set(key, [])
      }
      byParent.get(key)!.push(cat)
    }

    for (const [key, list] of byParent) {
      if (key === 'root') {
        list.sort((a, b) => a.sortOrder - b.sortOrder)
      } else {
        list.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
      }
    }

    const build = (parentId: string | null): CategoryWithChildren[] => {
      const key = getKey(parentId)
      const children = byParent.get(key) ?? []

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
        children: build(cat.id)
      }))
    }

    return build(null)
  }

  async getSearchSuggestions(search: string) {
    const q = search?.trim()

    if (!q || q.length < 2) return []

    const [categories, ads] = await Promise.all([
      this.prisma.category.findMany({
        where: {
          name: {
            contains: q,
            mode: 'insensitive'
          }
        },
        take: 5,
        select: { id: true, name: true }
      }),

      this.prisma.ad.findMany({
        where: {
          title: {
            contains: q,
            mode: 'insensitive'
          }
        },
        take: 10,
        select: { id: true, title: true }
      })
    ])

    const normalize = (str: string) => str.toLowerCase()

    const scoredCategories = categories.map(c => {
      const name = normalize(c.name)

      return {
        id: c.id,
        type: 'category' as const,
        rawName: c.name,
        name: `В категории: ${c.name}`,
        score: name.startsWith(q.toLowerCase()) ? 100 : 50
      }
    })

    const scoredAds = ads.map(a => {
      const title = normalize(a.title)

      return {
        id: a.id,
        type: 'ad' as const,
        rawName: a.title,
        name: a.title,
        score: title.startsWith(q.toLowerCase()) ? 100 : 50
      }
    })

    return [...scoredCategories, ...scoredAds]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ score, ...rest }) => rest)
  }
}
