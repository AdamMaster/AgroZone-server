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
  // Обязательный и стабильный — см. data/categories.ts, materializeCategories()
  // проставляет его автоматически (хэш от пути названий), если не задан явно.
  // Именно по нему матчим категорию при сидировании (см. upsertCategory) —
  // переименование/перенос категории меняют name/slug/fullPath, но НЕ id,
  // поэтому больше не создают дубль вместо обновления существующей строки.
  id: string
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

// Сводит feature.unit/feature.units (в data/categories.ts это два разных,
// необязательных поля — единица бывает задана либо как одна фиксированная
// строка, либо как список вариантов на выбор) к одному массиву. Первый
// элемент — каноническая единица (см. CategoryFeature.units в schema.prisma).
function normalizeUnits(feature: CategoryFeatureInput & { description?: string }): string[] {
  if (feature.units?.length) return feature.units
  if (feature.unit) return [feature.unit]
  return []
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

  // 1. Ищем существующую категорию — ПО ID, а не по fullPath. fullPath
  // (и code) считаются из текущего name, поэтому меняются при
  // переименовании/переносе категории; матчить по ним означало, что сид не
  // находил старую строку и создавал дубликат с новым id вместо обновления
  // существующей — объявления при этом не ломались (FK на старую строку
  // оставался валиден), но в дереве копился висящий дубль-призрак со старым
  // названием (см. обсуждение с пользователем). id стабилен (см. CategoryInput
  // выше), поэтому такого больше не происходит.
  //
  // Фолбэк на fullPath оставлен только на случай, если для какой-то строки
  // в базе ещё нет соответствия по id (не должно случаться для дерева из
  // data/categories.ts — там id проставлены для всех узлов, — но подстрахует
  // ручные правки в базе или более старые данные). В этом случае id
  // существующей строки НЕ трогаем (менять первичный ключ у строки, на
  // которую уже могут ссылаться объявления, — плохая идея), только
  // предупреждаем в консоль.
  let existing = await prisma.category.findUnique({ where: { id: data.id } })

  if (!existing) {
    existing = await prisma.category.findUnique({ where: { fullPath } })

    if (existing) {
      console.warn(
        `⚠ Категория "${data.name}" найдена по fullPath, а не по id (ожидался ${data.id}, у существующей строки id=${existing.id}). ` +
          `Использую существующую строку без изменения id. Если категория была переименована — убедитесь, что в CATEGORY_TREE ` +
          `для неё явно указан id: '${existing.id}'.`
      )
    }
  }

  const categoryData = {
    name: data.name,
    description: data.description ?? null,
    slug,
    path,
    fullPath,
    code,
    iconId: data.iconId,
    priceUnits,
    level,
    sortOrder,
    parentId
  }

  const category = existing
    ? await prisma.category.update({ where: { id: existing.id }, data: categoryData })
    : await prisma.category.create({ data: { id: data.id, ...categoryData } })

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
              // Раньше units (список единиц на выбор, например ['кВт',
              // 'л.с.'] у мощности) вообще не сохранялся — сохранялся
              // только unit (одна фиксированная единица), из-за чего поля
              // с несколькими вариантами единицы приходили на клиент без
              // единицы измерения вообще (см. обсуждение с пользователем
              // про поле "Мощность"). normalizeUnits сводит оба случая к
              // одному массиву — первый элемент считается канонической
              // единицей, в ней же значение хранится в Ad.features.
              units: normalizeUnits(feature),
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
