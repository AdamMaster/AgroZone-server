import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async getSearchSuggestions(qRaw: string) {
    try {
      const q = this.normalize(qRaw)

      if (!q || q.length < 2) {
        return []
      }

      const [categories, ads] = await Promise.all([
        this.prisma.$queryRaw<any[]>`
        SELECT
          id,
          name,
          slug,
          similarity(name, ${q}) *
          CASE
            WHEN name ILIKE ${q + '%'} THEN 1.5
            WHEN name ILIKE ${'%' + q + '%'} THEN 1.0
            ELSE 0.8
          END AS score
        FROM categories
        WHERE name % ${q}
        ORDER BY score DESC
        LIMIT 5
      `,

        this.prisma.$queryRaw<any[]>`
        SELECT
          id,
          title,
          slug,
          seo_path,
          similarity(title, ${q}) *
          CASE
            WHEN title ILIKE ${q + '%'} THEN 1.5
            WHEN title ILIKE ${'%' + q + '%'} THEN 1.0
            ELSE 0.7
          END AS score
        FROM ads
        WHERE title % ${q}
        ORDER BY score DESC
        LIMIT 10
      `
      ])

      const categoryItems = categories.map(category => ({
        id: category.id,
        type: 'category' as const,
        rawName: category.name,
        name: `Категория: ${category.name}`,
        slug: category.slug,
        url: `/catalog/${category.slug}`,
        score: Number(category.score || 0)
      }))

      const adItems = ads.map(ad => ({
        id: ad.id,
        type: 'ad' as const,
        rawName: ad.title,
        name: ad.title,
        slug: ad.slug,
        url: ad.seo_path ? `/catalog/${ad.seo_path}` : '',
        score: Number(ad.score)
      }))

      return [...categoryItems, ...adItems].sort((a, b) => b.score - a.score).slice(0, 10)
    } catch (e) {
      console.error('SEARCH ERROR:', e)
      throw e
    }
  }

  private normalize(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, ' ')
  }
}
