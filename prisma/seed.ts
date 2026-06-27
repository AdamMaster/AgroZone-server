import { PrismaClient } from './generated/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { CATEGORIES_DATA } from './data/categories'
import slugify from 'slugify'

const pool = new Pool({ connectionString: process.env.POSTGRES_URI })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

type FeatureInput = {
  name: string
  label: string
  type: 'text' | 'number' | 'select' | 'boolean'
  options?: string[]
  required: boolean
}

type CategoryInput = {
  name: string
  iconId?: string
  code?: string
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

function generateCode(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/ё/g, 'e')
    .replace(/[^a-zа-я0-9\s-]/g, '')
    .replace(/\s+/g, '-')
}

function buildCode(parentCode: string | null, name: string) {
  const base = generateCode(name)

  return parentCode ? `${parentCode}_${base}` : base
}

async function upsertCategory(
  data: CategoryInput,
  parentId: string | null = null,
  parentCode: string | null = null,
  parentSlug: string | null = null,
  level = 0
) {
  const currentSubSlug = generateSlug(data.name)
  const slug = parentSlug ? `${parentSlug}/${currentSubSlug}` : currentSubSlug

  const existingCategory = await prisma.category.findUnique({
    where: { slug }
  })

  let category

  if (existingCategory) {
    category = await prisma.category.update({
      where: { id: existingCategory.id },
      data: {
        name: data.name,
        iconId: data.iconId,
        parentId,
        level,
        availableFeatures: data.features ?? undefined
      }
    })
  } else {
    const newCode = data.code ?? buildCode(parentCode, data.name)

    category = await prisma.category.create({
      data: {
        name: data.name,
        code: newCode,
        slug,
        iconId: data.iconId,
        parentId,
        level,
        availableFeatures: data.features ?? undefined
      }
    })
  }

  if (data.children?.length) {
    for (const child of data.children) {
      await upsertCategory(child, category.id, category.code, slug, level + 1)
    }
  }

  return category
}

async function main(): Promise<void> {
  console.log('Начало заполнения базы данных категориями...')

  // await prisma.category.deleteMany()

  for (const rootCategory of CATEGORIES_DATA) {
    await upsertCategory(rootCategory)
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
