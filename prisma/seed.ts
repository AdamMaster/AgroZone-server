import { PrismaClient, FeatureType, PriceUnit, Prisma } from './generated/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { CATEGORIES_DATA, CategoryFeatureInput } from './data/categories'
import { RU_CITIES_DATA } from './data/ru-cities'
import slugify from 'slugify'

const pool = new Pool({
  connectionString: process.env.POSTGRES_URI
})

const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({
  adapter
})

// Маппинг строковых единиц цены из категорий в Enum Prisma
const PRICE_UNIT_MAP: Record<string, PriceUnit> = {
  шт: PriceUnit.ITEM,
  ITEM: PriceUnit.ITEM,
  т: PriceUnit.TON,
  TON: PriceUnit.TON,
  кг: PriceUnit.KG,
  KG: PriceUnit.KG,
  л: PriceUnit.LITER,
  LITER: PriceUnit.LITER,
  'куб.м': PriceUnit.M3,
  M3: PriceUnit.M3,
  мешок: PriceUnit.BAG,
  BAG: PriceUnit.BAG,
  голова: PriceUnit.HEAD,
  HEAD: PriceUnit.HEAD,
  доза: PriceUnit.DOSE,
  DOSE: PriceUnit.DOSE,
  'пог. м': PriceUnit.RUNNING_METER,
  RUNNING_METER: PriceUnit.RUNNING_METER,
  га: PriceUnit.HA,
  HA: PriceUnit.HA,
  час: PriceUnit.HOUR,
  HOUR: PriceUnit.HOUR
}

type CategoryInput = {
  id?: string
  name: string
  description?: string
  iconId?: string
  code?: string
  priceUnits?: string[]
  sortOrder?: number
  children?: CategoryInput[]
  categoryFeatures?: (CategoryFeatureInput & {
    description?: string
  })[]
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

function mapPriceUnits(units?: string[]): PriceUnit[] {
  if (!units || units.length === 0) return [PriceUnit.ITEM]
  return units.map(u => PRICE_UNIT_MAP[u] || PriceUnit.ITEM)
}

async function upsertCategory(
  data: CategoryInput,
  parentId: string | null = null,
  parentCode: string | null = null,
  parentPath: string[] = [],
  level = 0,
  defaultSortOrder = 0
) {
  const slug = generateSlug(data.name)
  const path = [...parentPath, slug]
  const fullPath = path.join('/')
  const code = data.code ?? buildCode(parentCode, data.name)
  const priceUnits = mapPriceUnits(data.priceUnits)
  const sortOrder = data.sortOrder ?? defaultSortOrder

  // 1. Создаем или обновляем категорию со всеми новыми полями
  const category = await prisma.category.upsert({
    where: { fullPath },
    update: {
      name: data.name,
      description: data.description ?? null, // 👈 Добавлено
      slug,
      path,
      code,
      iconId: data.iconId,
      priceUnits, // 👈 Добавлено
      level,
      sortOrder, // 👈 Добавлено
      parentId
    },
    create: {
      ...(data.id ? { id: data.id } : {}),
      name: data.name,
      description: data.description ?? null,
      slug,
      path,
      fullPath,
      code,
      iconId: data.iconId,
      priceUnits, // 👈 Добавлено
      level,
      sortOrder, // 👈 Добавлено
      parentId
    }
  })

  // 2. Пересоздаем характеристики в транзакции
  await prisma.$transaction([
    prisma.categoryFeature.deleteMany({
      where: { categoryId: category.id }
    }),
    ...(data.categoryFeatures?.length
      ? [
          prisma.categoryFeature.createMany({
            data: data.categoryFeatures.map((feature, index) => ({
              categoryId: category.id,
              name: feature.name,
              label: feature.label,
              description: feature.description ?? null, // 👈 Добавлено
              type: featureTypeMap[feature.type],
              required: feature.required ?? false,
              filterable: feature.filterable ?? true,
              placeholder: feature.placeholder ?? null, // 👈 Добавлено
              unit: feature.unit ?? null, // 👈 Добавлено
              options: (feature.options ?? Prisma.JsonNull) as Prisma.InputJsonValue,
              sortOrder: feature.sortOrder ?? index
            }))
          })
        ]
      : [])
  ])

  // 3. Обрабатываем дочерние элементы
  if (data.children?.length) {
    for (let i = 0; i < data.children.length; i++) {
      await upsertCategory(data.children[i], category.id, category.code, path, level + 1, i)
    }
  }

  return category
}

// Справочник городов (RuCity) — статичный, полностью заменяем при каждом
// сиде (deleteMany + createMany), в отличие от категорий тут не нужен
// upsert по одной записи — нет ни дочерних сущностей, ни ручных
// правок поверх сид-данных, которые было бы жалко потерять.
async function seedCities() {
  console.log(`🌍 Импорт справочника городов (${RU_CITIES_DATA.length})...`)

  await prisma.ruCity.deleteMany()
  await prisma.ruCity.createMany({ data: RU_CITIES_DATA })

  console.log('✔ Справочник городов импортирован')
}

async function main() {
  console.log('🚀 Начало импорта категорий...')

  for (let i = 0; i < CATEGORIES_DATA.length; i++) {
    const category = CATEGORIES_DATA[i]
    await upsertCategory(category, null, null, [], 0, i)
    console.log(`✔ Категория обработана: ${category.name}`)
  }

  await seedCities()

  console.log('🎉 Импорт успешно завершён!')
}

main()
  .catch(e => {
    console.error('❌ Ошибка при импорте:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
