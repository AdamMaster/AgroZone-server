import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { EmbeddingsService } from '../src/libs/embeddings/embeddings.service'

// Скрипт разовый/по требованию — запускать руками после того как обновили
// description категорий (см. enrich-category-descriptions.ts) или добавили
// новые категории:
//   npx dotenv -e .env -- ts-node scripts/precompute-category-embeddings.ts
//
// Считает эмбеддинг НЕ на всю категорию разом, а по отдельному термину:
// название категории — свой термин, и каждое слово/фраза из description
// (обогащённого через GigaChat списка синонимов через запятую) — тоже свой
// отдельный термин, со своим вектором в таблице CategoryTerm. Так и нужно —
// один общий вектор на категорию (mean pooling по name + всему списку разом)
// пробовали раньше, и "туя" в списке из 25 пород давала слишком слабый
// вклад в общий вектор, поиск по "туи" не находил категорию, хотя туя в
// описании была (см. обсуждение с пользователем и комментарий в
// schema.prisma у Category.terms). CategoriesService.searchBySemantic берёт
// МАКСИМУМ по терминам категории, а не среднее — так что достаточно, чтобы
// совпал ХОТЯ БЫ ОДИН термин.
//
// Через Nest DI не идём (как и остальные скрипты в scripts/, см.
// backfill-category-path.ts) — тут это не нужно, EmbeddingsService и без
// Nest прекрасно работает как обычный класс.

const pool = new Pool({ connectionString: process.env.POSTGRES_URI })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const embeddingsService = new EmbeddingsService()

const CHUNK_SIZE = 32

// --force — пересчитать термины вообще у всех категорий, а не только у тех,
// у которых ещё нет ни одного термина в CategoryTerm. Нужно при смене модели
// эмбеддингов (векторы из разных моделей несравнимы) или если поменяли сам
// принцип разбиения на термины.
//   npm run embeddings:precompute -- --force
const force = process.argv.includes('--force')

// Description — это строка "термин1, термин2, термин3, ..." от GigaChat
// (см. enrich-category-descriptions.ts). Разбиваем по запятой, чистим
// пробелы, выкидываем пустые и совсем короткие обрывки.
function splitTerms(description: string | null): string[] {
  if (!description) return []

  return description
    .split(',')
    .map(term => term.trim())
    .filter(term => term.length >= 2)
}

async function run() {
  // По умолчанию — только категории, у которых в CategoryTerm вообще ещё
  // нет ни одной записи (значит термины под них ни разу не считались). С
  // --force берём все категории и полностью пересоздаём им термины.
  const categories = await prisma.category.findMany({
    where: force ? {} : { terms: { none: {} } },
    select: { id: true, name: true, description: true }
  })

  if (categories.length === 0) {
    console.log('Нечего пересчитывать — у всех категорий уже есть термины (используйте --force для пересчёта).')

    return
  }

  console.log(`Считаю термины для ${categories.length} категорий...`)

  let done = 0

  for (const category of categories) {
    // Название категории — тоже термин (иначе точное совпадение вроде
    // "саженцы" перестанет работать так же хорошо, как раньше).
    const terms = [category.name, ...splitTerms(category.description)]

    // На всякий случай убираем дубли (GigaChat иногда повторяет термин
    // дважды в разных формах, а "туя" может совпасть с названием категории).
    const uniqueTerms = [...new Set(terms)]

    // Раз пересчитываем — сносим старые термины этой категории, чтобы не
    // плодить дубли при повторном запуске с --force.
    await prisma.categoryTerm.deleteMany({ where: { categoryId: category.id } })

    for (let i = 0; i < uniqueTerms.length; i += CHUNK_SIZE) {
      const chunk = uniqueTerms.slice(i, i + CHUNK_SIZE)
      const vectors = await embeddingsService.getCategoryEmbeddings(chunk)

      await prisma.categoryTerm.createMany({
        data: chunk.map((term, indexInChunk) => ({
          categoryId: category.id,
          term,
          embedding: vectors[indexInChunk]
        }))
      })
    }

    done++

    console.log(`${done} / ${categories.length} — "${category.name}": ${uniqueTerms.length} термин(ов)`)
  }

  console.log('ГОТОВО')
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
