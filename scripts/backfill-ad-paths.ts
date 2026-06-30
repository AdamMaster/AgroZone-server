import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Подтягиваем .env
dotenv.config({ path: resolve(__dirname, '../.env') })

import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../prisma/generated/client' // Твой относительный путь к клиенту

const pool = new Pool({ connectionString: process.env.POSTGRES_URI })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function run() {
  // 1. Собираем только нужные данные
  const [ads, categories] = await Promise.all([
    prisma.ad.findMany({
      select: { id: true, categoryId: true, slug: true }
    }),
    prisma.category.findMany({
      select: { id: true, path: true } // Забираем уже готовый массив путей!
    })
  ])

  const categoryMap = new Map<string, string[]>(categories.map(c => [c.id, c.path]))

  // 2. Формируем массив апдейтов
  const updates = ads.map(ad => {
    const categoryPath = categoryMap.get(ad.categoryId) || []

    // Склеиваем путь категории со слагом самого объявления
    const seoPath = [...categoryPath, ad.slug].join('/')

    return prisma.ad.update({
      where: { id: ad.id },
      data: {
        categoryPath,
        seoPath
      }
    })
  })

  // 3. Батчинг (ограничиваем параллелизм по 50 штук)
  const chunkSize = 50
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize)
    await Promise.all(chunk)
    console.log(`Обработано объявлений: ${i + chunk.length}/${ads.length}`)
  }

  console.log('🎉 ВСЕ ОБЪЯВЛЕНИЯ УСПЕШНО ОБНОВЛЕНЫ!')
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
