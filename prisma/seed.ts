import { PrismaClient, FeatureType } from './generated/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { CATEGORIES_DATA, CategoryFeatureInput } from './data/categories'
import slugify from 'slugify'

const pool = new Pool({
  connectionString: process.env.POSTGRES_URI
})

const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({
  adapter
})

type CategoryInput = {
  name: string
  iconId?: string
  code?: string
  children?: CategoryInput[]
  categoryFeatures?: CategoryFeatureInput[]
}

const featureTypeMap: Record<CategoryFeatureInput['type'], FeatureType> = {
  TEXT: FeatureType.TEXT,
  NUMBER: FeatureType.NUMBER,
  BOOLEAN: FeatureType.BOOLEAN,
  SELECT: FeatureType.SELECT,
  MULTI_SELECT: FeatureType.MULTI_SELECT
}

function generateSlug(text: string) {
  return slugify(text, {
    lower: true,
    strict: true,
    locale: 'ru'
  })
}

function generateCode(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s-]/gi, '')
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
  parentPath: string[] = [],
  level = 0
) {
  const slug = generateSlug(data.name)

  const path = [...parentPath, slug]

  const fullPath = path.join('/')

  const code = data.code ?? buildCode(parentCode, data.name)

  let category = await prisma.category.findUnique({
    where: {
      fullPath
    }
  })

  if (category) {
    category = await prisma.category.update({
      where: {
        id: category.id
      },
      data: {
        name: data.name,
        slug,
        path,
        fullPath,
        code,
        iconId: data.iconId,
        level,
        parent: parentId
          ? {
              connect: {
                id: parentId
              }
            }
          : {
              disconnect: true
            }
      }
    })
  } else {
    category = await prisma.category.create({
      data: {
        name: data.name,
        slug,
        path,
        fullPath,
        code,
        iconId: data.iconId,
        level,
        parent: parentId
          ? {
              connect: {
                id: parentId
              }
            }
          : undefined
      }
    })
  }

  await prisma.categoryFeature.deleteMany({
    where: {
      categoryId: category.id
    }
  })

  if (data.categoryFeatures?.length) {
    await prisma.categoryFeature.createMany({
      data: data.categoryFeatures.map((feature, index) => ({
        categoryId: category.id,

        name: feature.name,
        label: feature.label,

        type: featureTypeMap[feature.type],

        required: feature.required ?? false,
        filterable: true,

        options: feature.options,

        sortOrder: index
      }))
    })
  }

  if (data.children?.length) {
    for (const child of data.children) {
      await upsertCategory(child, category.id, category.code, path, level + 1)
    }
  }

  return category
}

async function main() {
  console.log('Начало импорта категорий...')

  // Если нужен полный пересид:
  // await prisma.category.deleteMany()

  for (const category of CATEGORIES_DATA) {
    await upsertCategory(category)
    console.log(`✔ ${category.name}`)
  }

  console.log('Импорт завершён.')
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
