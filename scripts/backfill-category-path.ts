import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from 'prisma/generated/client'

const pool = new Pool({ connectionString: process.env.POSTGRES_URI })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

type Category = {
  id: string
  slug: string
  parentId: string | null
}

async function buildCategoryMap() {
  const categories = await prisma.category.findMany({
    select: {
      id: true,
      slug: true,
      parentId: true
    }
  })

  const map = new Map<string, Category>()

  for (const c of categories) {
    map.set(c.id, c)
  }

  return map
}

function getCategoryPath(categoryId: string, map: Map<string, Category>): string[] {
  const path: string[] = []
  const visited = new Set<string>()

  let current = map.get(categoryId)

  while (current) {
    // 🔥 защита от циклов
    if (visited.has(current.id)) {
      console.error('CYCLE DETECTED in categories:', current)
      break
    }

    visited.add(current.id)

    // кладём slug
    path.unshift(current.slug)

    if (!current.parentId) break

    current = map.get(current.parentId)
  }

  return path
}

async function run() {
  const [ads, categoryMap] = await Promise.all([
    prisma.ad.findMany({
      select: {
        id: true,
        categoryId: true
      }
    }),
    buildCategoryMap()
  ])

  const chunkSize = 50

  for (let i = 0; i < ads.length; i += chunkSize) {
    const chunk = ads.slice(i, i + chunkSize)

    await Promise.all(
      chunk.map(ad => {
        const categoryPath = getCategoryPath(ad.categoryId, categoryMap)

        return prisma.ad.update({
          where: { id: ad.id },
          data: {
            categoryPath
          }
        })
      })
    )
  }

  console.log('DONE')
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
