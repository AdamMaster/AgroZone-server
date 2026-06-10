import { PrismaClient } from './generated/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { CATEGORIES_DATA } from './data/categories'

const pool = new Pool({ connectionString: process.env.POSTGRES_URI })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Типы оставляем как есть
type FeatureInput = {
  name: string
  label: string
  type: 'text' | 'number' | 'select' | 'boolean'
  options?: string[]
  required: boolean
}

type CategoryInput = {
  name: string
  children?: CategoryInput[]
  features?: FeatureInput[]
}

// Рекурсивная функция — это самый чистый способ
async function createCategory(data: CategoryInput, parentId: string | null = null) {
  // Создаем категорию
  const category = await prisma.category.create({
    data: {
      name: data.name,
      parentId: parentId,
      // Сохраняем features как JSON в поле availableFeatures
      availableFeatures: data.features ? JSON.parse(JSON.stringify(data.features)) : null
    }
  })

  // Рекурсивно создаем детей
  if (data.children && data.children.length > 0) {
    for (const child of data.children) {
      await createCategory(child, category.id)
    }
  }
}

async function main(): Promise<void> {
  console.log('Начало заполнения базы данных категориями...')

  await prisma.category.deleteMany()

  for (const rootCategory of CATEGORIES_DATA) {
    await createCategory(rootCategory)
    console.log(`Создана ветка: ${rootCategory.name}`)
  }

  console.log('Импорт успешно завершен!')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
