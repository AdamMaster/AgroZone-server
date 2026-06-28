import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from 'prisma/generated/client'

const pool = new Pool({ connectionString: process.env.POSTGRES_URI })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function run() {
  const ads = await prisma.ad.findMany({
    select: {
      id: true,
      categoryId: true
    }
  })

  for (const ad of ads) {
    const path: string[] = []

    let current = await prisma.category.findUnique({
      where: { id: ad.categoryId },
      select: { slug: true, parentId: true }
    })

    while (current) {
      path.unshift(current.slug)

      if (!current.parentId) break

      current = await prisma.category.findUnique({
        where: { id: current.parentId },
        select: { slug: true, parentId: true }
      })
    }

    await prisma.ad.update({
      where: { id: ad.id },
      data: {
        categoryPath: path
      }
    })
  }

  console.log('DONE')
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
