import { PrismaClient } from './generated/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { CATEGORIES_DATA } from './data/categories'
import slugify from 'slugify'

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

const generateSlug = (text: string) => {
  return slugify(text, {
    lower: true,
    strict: true,
    locale: 'ru'
  })
}

async function createCategory(data: CategoryInput, parentId: string | null = null, parentSlug: string | null = null) {
  const currentSlug = generateSlug(data.name)
  const finalSlug = parentSlug ? `${parentSlug}/${currentSlug}` : currentSlug

  const category = await prisma.category.create({
    data: {
      name: data.name,
      slug: finalSlug,
      parentId: parentId,
      availableFeatures: data.features ? JSON.parse(JSON.stringify(data.features)) : null
    }
  })

  if (data.children && data.children.length > 0) {
    for (const child of data.children) {
      await createCategory(child, category.id, finalSlug)
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
