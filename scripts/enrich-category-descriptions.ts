import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import type { ConfigService } from '@nestjs/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { GigaChatService } from '../src/libs/gigachat/gigachat.service'

// Разовый скрипт: просит GigaChat сгенерировать для каждой категории
// список обиходных названий/сортов/видов товаров, которые в неё логично
// отнести — и кладёт это в Category.description, через запятую (термин1,
// термин2, ...). После этого нужно ОБЯЗАТЕЛЬНО прогнать
//   npm run embeddings:precompute -- --force
// (именно с --force) — precompute-category-embeddings.ts бьёт description
// на отдельные термины и считает эмбеддинг КАЖДОМУ термину отдельно (не
// одному вектору на всё description разом — так пробовали, не сработало,
// см. комментарий в schema.prisma у CategoryTerm), а без --force он
// пропустит категории, у которых термины уже когда-то были посчитаны.
//
// Смысл в том, чтобы НЕ писать эти синонимы руками для каждой категории
// (агропромышленная лексика огромная — виды растений, породы, сорта грибов
// и т.д., см. обсуждение с пользователем) — вместо этого GigaChat один раз
// генерирует их сам по названию категории.
//
//   npx dotenv -e .env -- ts-node scripts/enrich-category-descriptions.ts
//   npx dotenv -e .env -- ts-node scripts/enrich-category-descriptions.ts --force
//
// Через Nest DI не идём (как и остальные скрипты в scripts/) — GigaChatService
// и ConfigService прекрасно работают и как обычные классы вне Nest-контекста.

const pool = new Pool({ connectionString: process.env.POSTGRES_URI })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// GigaChatService у нас просит только configService.getOrThrow(...) —
// поднимать ради одного этого метода настоящий @nestjs/config ConfigService
// вне Nest-контекста смысла нет (его конструктор не для этого), поэтому
// передаём минимальную самодельную реализацию поверх process.env.
class EnvConfigService {
  getOrThrow<T = string>(key: string): T {
    const value = process.env[key]

    if (value === undefined || value === '') {
      throw new Error(`Переменная окружения ${key} не задана`)
    }

    return value as unknown as T
  }
}

const gigaChatService = new GigaChatService(new EnvConfigService() as unknown as ConfigService)

// --force — перегенерировать описание даже у категорий, у которых оно уже
// есть (например если хотим обновить формулировки или сменили промпт).
// По умолчанию трогаем только категории с пустым description, чтобы
// повторный запуск (после добавления новых категорий) не жёг токены
// впустую на те, что уже обогащены.
const force = process.argv.includes('--force')

// Между запросами — небольшая пауза, чтобы не долбить GigaChat пачкой
// параллельных запросов и не словить лимит по RPS у бесплатного тарифа.
const DELAY_BETWEEN_REQUESTS_MS = 300

function buildPrompt(categoryName: string, parentName: string | null): string {
  const parentContext = parentName ? ` (входит в раздел "${parentName}")` : ''

  return (
    `Ты помощник интернет-магазина сельскохозяйственных товаров "AgroZone". ` +
    `Есть категория объявлений: "${categoryName}"${parentContext}. ` +
    `Перечисли через запятую 15-25 конкретных примеров товаров, культур, пород, сортов, видов ` +
    `и их обиходных/разговорных названий, которые логично отнести именно к этой категории, а не к соседним. ` +
    `Не пиши вступление, пояснения, нумерацию или заключение — верни только сам список через запятую.`
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function run() {
  const categories = await prisma.category.findMany({
    where: force ? {} : { OR: [{ description: null }, { description: '' }] },
    select: { id: true, name: true, description: true, parent: { select: { name: true } } }
  })

  if (categories.length === 0) {
    console.log('Нечего обогащать — у всех категорий уже есть описание (используйте --force для перегенерации).')

    return
  }

  console.log(`Обогащаю описания для ${categories.length} категорий через GigaChat...`)

  let done = 0

  for (const category of categories) {
    const prompt = buildPrompt(category.name, category.parent?.name ?? null)

    try {
      const generated = await gigaChatService.generateText(prompt)

      await prisma.category.update({
        where: { id: category.id },
        data: { description: generated }
      })

      done++

      console.log(`${done} / ${categories.length} — "${category.name}": ${generated}`)
    } catch (error) {
      console.error(`Не удалось обогатить "${category.name}":`, error)
    }

    await sleep(DELAY_BETWEEN_REQUESTS_MS)
  }

  console.log('ГОТОВО. Теперь запустите: npm run embeddings:precompute -- --force')
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
