import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(__dirname, '../.env') })

import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../prisma/generated/client'

const pool = new Pool({ connectionString: process.env.POSTGRES_URI })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function cleanCategories() {
  // 1. Получаем все категории
  const categories = await prisma.category.findMany({
    select: { id: true, slug: true, parentId: true }
  })

  console.log(`Найдено категорий для анализа: ${categories.length}`)

  // Карта для быстрого поиска
  const categoryMap = new Map(categories.map(c => [c.id, c]))

  // Функция для сборки чистого массива путей из ID
  function buildPathArray(categoryId: string): string[] {
    const pathSlugs: string[] = []
    let current = categoryMap.get(categoryId)

    while (current) {
      // Забираем ТОЛЬКО хвост слага (например, из "a/b/c" достаем "c")
      const pureSlug = current.slug.includes('/') ? current.slug.split('/').pop()! : current.slug

      pathSlugs.unshift(pureSlug)
      if (!current.parentId) break
      current = categoryMap.get(current.parentId)
    }
    return pathSlugs
  }

  // 2. Обновляем каждую категорию в базе
  for (const category of categories) {
    // Получаем массив чистых слагов всей цепочки: ["agrohimiya", "biopreparaty"]
    const computedPath = buildPathArray(category.id)

    // Делаем уникальный слаг: если это подкатегория, склеиваем её путь через дефис
    // Например, было "agrohimiya/biopreparaty" -> станет "agrohimiya-biopreparaty"
    const newUniqueSlug = computedPath.join('-')

    try {
      await prisma.category.update({
        where: { id: category.id },
        data: {
          slug: newUniqueSlug, // Теперь он уникален для базы данных!
          path: computedPath // А тут чистый массив путей ["agrohimiya", "biopreparaty"]
        }
      })
    } catch (err) {
      console.error(` Ошибка обновления категории ID ${category.id} (slug: ${newUniqueSlug}):`, err)
    }
  }

  console.log('✅ База данных категорий успешно очищена и переведена на Вариант А!')
}

cleanCategories()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
