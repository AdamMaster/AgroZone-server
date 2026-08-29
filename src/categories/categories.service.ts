import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { CategoryFeature } from '@/generated/prisma/client'
import { EmbeddingsService } from '@/libs/embeddings/embeddings.service'

export interface CategorySearchResult {
  id: string
  name: string
  slug: string
  parentName: string | null
  // Какой именно термин категории совпал с запросом лучше всего — полезно
  // и для отладки ("а, вот почему туи нашли саженцы — совпало по термину
  // 'туя западная'"), и потом можно показать в UI как подсказку.
  matchedTerm: string
  score: number
}

// Плоская, уже готовая к сравнению запись термина — то, что реально лежит
// в термин-кэше (см. CategoriesService.termCache). Не тот же тип, что
// возвращает Prisma (там term.category.name и т.п. вложенно) — тут всё
// заранее разложено по плоским полям, чтобы в горячем пути поиска
// (searchBySemantic) не тратить время на .category.name на каждой из
// тысяч записей при каждом запросе.
interface CachedCategoryTerm {
  term: string
  embedding: number[]
  categoryId: string
  categoryName: string
  categorySlug: string
  parentName: string | null
}

export interface CategoryWithChildren {
  id: string
  name: string
  slug: string
  code: string
  iconId: string | null
  parentId: string | null
  level: number
  sortOrder: number
  categoryFeatures: CategoryFeature[]
  path: string[]
  fullPath: string
  priceUnits: string[]
  children: CategoryWithChildren[]
}

@Injectable()
export class CategoriesService implements OnModuleInit {
  private readonly logger = new Logger(CategoriesService.name)

  // Кэш терминов для семантического поиска — грузится в память один раз
  // при старте сервера (см. onModuleInit) вместо того, чтобы гонять ~12
  // тысяч строк с векторами через Prisma на КАЖДЫЙ поисковый запрос. Так
  // изначально и было сделано — и на практике же и упёрлось: у пользователя
  // прямой запрос всех терминов на каждый /search-suggest стабильно валился
  // в ETIMEDOUT (см. обсуждение с пользователем — реальный лог ошибки).
  // Минус подхода: после precompute-category-embeddings.ts (пересчёт
  // терминов) кэш работающего сервера сам не обновится — нужно перезапустить
  // dev-сервер, чтобы onModuleInit перечитал таблицу заново. Это тот же
  // компромисс, что и с прогревом модели в EmbeddingsService.onModuleInit.
  private termCache: CachedCategoryTerm[] = []

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingsService: EmbeddingsService
  ) {}

  async onModuleInit() {
    await this.reloadTermCache()
  }

  async reloadTermCache(): Promise<void> {
    const terms = await this.prisma.categoryTerm.findMany({
      // Только листовые категории — см. searchBySemantic ниже, почему.
      where: { category: { children: { none: {} } } },
      select: {
        term: true,
        embedding: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            parent: { select: { name: true } }
          }
        }
      }
    })

    this.termCache = terms.map(item => ({
      term: item.term,
      embedding: item.embedding,
      categoryId: item.category.id,
      categoryName: item.category.name,
      categorySlug: item.category.slug,
      parentName: item.category.parent?.name ?? null
    }))

    this.logger.log(`Кэш терминов категорий для семантического поиска загружен: ${this.termCache.length} терминов`)
  }

  async findAll(): Promise<CategoryWithChildren[]> {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        categoryFeatures: true
      }
    })

    const byParent = new Map<string, typeof categories>()

    const key = (parentId: string | null) => parentId ?? 'root'

    for (const cat of categories) {
      const k = key(cat.parentId)

      if (!byParent.has(k)) {
        byParent.set(k, [])
      }

      byParent.get(k)!.push(cat)
    }

    const build = (parentId: string | null): CategoryWithChildren[] => {
      const children = byParent.get(key(parentId)) ?? []

      return children.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        code: cat.code,
        iconId: cat.iconId,
        parentId: cat.parentId,
        level: cat.level,
        sortOrder: cat.sortOrder,
        categoryFeatures: cat.categoryFeatures,
        path: cat.path,
        fullPath: cat.fullPath,
        priceUnits: cat.priceUnits,
        children: build(cat.id)
      }))
    }

    return build(null)
  }

  async getCategoryPath(categoryId: string): Promise<string[]> {
    const path: string[] = []

    let current = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { slug: true, parentId: true }
    })

    while (current) {
      path.unshift(current.slug)

      if (!current.parentId) break

      current = await this.prisma.category.findUnique({
        where: { id: current.parentId },
        select: { slug: true, parentId: true }
      })
    }

    return path
  }

  buildSeoPath(categoryPath: string[], slug: string): string {
    return [...categoryPath, slug].join('/')
  }

  /**
   * Семантический поиск категории по свободному тексту (например "Туи" →
   * "Саженцы") — в отличие от обычного текстового поиска, находит категорию
   * и тогда, когда введённое слово не встречается ни в названии, ни в пути
   * категории. См. обсуждение с пользователем и EmbeddingsService.
   *
   * Сравниваем запрос не с одним вектором на категорию, а со ВСЕМИ её
   * терминами (название + каждый синоним из обогащённого description, см.
   * scripts/precompute-category-embeddings.ts) и берём МАКСИМУМ по каждой
   * категории. Пробовали раньше один усреднённый вектор на категорию —
   * не сработало: mean pooling по названию + списку из 15-25 синонимов
   * размывает вклад любого одного слова ("туя" в списке из 25 пород даёт
   * ~1/25 сигнала), и поиск не находил категорию, даже когда нужное слово
   * было прямо в её description. С максимумом по отдельным термин-векторам
   * достаточно, чтобы совпал хотя бы один термин.
   *
   * Векторы терминов и запроса уже L2-нормализованы (см. EmbeddingsService
   * — normalize: true), поэтому косинусное сходство сводится к обычному
   * скалярному произведению.
   *
   * Сравниваем с термин-кэшем в памяти (см. termCache/reloadTermCache
   * выше), а не с базой на каждый запрос — так и было раньше, пока не
   * выяснилось, что прямой запрос ~12 тысяч строк с векторами на каждый
   * /search-suggest стабильно упирается в ETIMEDOUT (см. обсуждение с
   * пользователем).
   *
   * Кэш уже отфильтрован до ЛИСТОВЫХ категорий (без детей, см.
   * reloadTermCache) — только их вообще можно выбрать как итоговую
   * категорию объявления (см. на клиенте CategoryCascader.handleCategorySelect
   * — категория с детьми клику не финализирует выбор, а раскрывает колонки
   * для уточнения). Если бы сюда попадала родительская категория, на
   * мобильной версии (где колонок с уточнением нет — см. обсуждение с
   * пользователем про мобилку у Авито) пользователю было бы некуда её
   * уточнить дальше.
   */
  async searchBySemantic(query: string, limit = 5): Promise<CategorySearchResult[]> {
    const q = query.trim()

    if (q.length < 2) return []

    const queryVector = await this.embeddingsService.getQueryEmbedding(q)

    const bestByCategory = new Map<string, CategorySearchResult>()

    for (const item of this.termCache) {
      // Чистая косинусная близость эмбеддингов на коротких запросах (2-4
      // буквы) оказалась шумной — см. обсуждение с пользователем: запрос
      // "туи" находил "Чечевицу" по термину "пюи" (0.855) выше, чем
      // правильную "Саженцы хвойных пород" по термину "туя шаровидная"
      // (0.841), просто потому что "пюи" и "туи" ОРФОГРАФИЧЕСКИ похожи
      // (оба короткие, оба заканчиваются на "и"), а не потому что модель
      // увидела смысловую связь. На длинных запросах такого разрыва почти
      // не бывает — там эмбеддинг несёт достаточно сигнала сам по себе.
      // Поэтому добавляем лексический бонус: буквальное вхождение или
      // близость по Левенштейну между запросом и термином (или отдельным
      // словом внутри термина, см. lexicalSimilarity) — он ощутимо топит
      // случайные орфографические совпадения ("пюи", "сои", "чай"), не
      // перекрывая при этом настоящий семантический сигнал на длинных
      // запросах, где лексическая близость естественным образом мала.
      const semanticScore = this.dotProduct(queryVector, item.embedding)
      const lexicalScore = this.lexicalSimilarity(q, item.term)
      const score = semanticScore + LEXICAL_BOOST_WEIGHT * lexicalScore
      const current = bestByCategory.get(item.categoryId)

      if (!current || score > current.score) {
        bestByCategory.set(item.categoryId, {
          id: item.categoryId,
          name: item.categoryName,
          slug: item.categorySlug,
          parentName: item.parentName,
          matchedTerm: item.term,
          score
        })
      }
    }

    // На абсолютно бессмысленный запрос (клавиатурный набор без слов)
    // косинусное сходство всё равно не проваливается в ноль — у e5-base
    // (как и у большинства подобных моделей без спец. калибровки) score
    // почти для ЛЮБОЙ пары текстов сжат в узкий высокий диапазон, "нуля
    // непохожести" тут просто не существует (см. обсуждение с
    // пользователем — реальный тест: крякозябра "йцкрпйукр..." дала топ-score
    // 0.838, притом что уверенное совпадение "ель голубая" → "Саженцы
    // хвойных пород" даёт 0.90+, а самое слабое из его топ-5 — 0.861).
    // Между 0.838 и 0.861 есть зазор — MIN_SCORE отрезает по нему: ниже
    // порога вообще не показываем подсказки (пусть будет пустое состояние),
    // чем врать пользователю правдоподобным на вид, но случайным списком.
    return [...bestByCategory.values()]
      .filter(result => result.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  private dotProduct(a: number[], b: number[]): number {
    let sum = 0

    for (let i = 0; i < a.length && i < b.length; i++) {
      sum += a[i] * b[i]
    }

    return sum
  }

  /**
   * Лексическая близость запроса к термину, от 0 до 1 — буквальное
   * вхождение (в любую сторону) даёт максимум, иначе берём лучшую
   * (наименьшее расстояние Левенштейна, нормированное на длину) близость
   * запроса к ОТДЕЛЬНОМУ слову термина, а не ко всему термину целиком —
   * термины часто составные ("туя шаровидная", "саженцы плодовых
   * деревьев"), и сравнивать короткий запрос со всей строкой сразу
   * бессмысленно ослабляло бы бонус ровно для тех термина, где он нужнее
   * всего. См. searchBySemantic — зачем это вообще понадобилось.
   */
  private lexicalSimilarity(query: string, term: string): number {
    const q = query.toLowerCase()
    const t = term.toLowerCase()

    if (t.includes(q) || q.includes(t)) return 1

    let best = 0

    for (const word of t.split(/\s+/)) {
      const maxLen = Math.max(q.length, word.length)

      if (maxLen === 0) continue

      const similarity = 1 - this.levenshtein(q, word) / maxLen

      if (similarity > best) best = similarity
    }

    return best
  }

  private levenshtein(a: string, b: string): number {
    const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))

    for (let i = 0; i <= a.length; i++) dp[i][0] = i
    for (let j = 0; j <= b.length; j++) dp[0][j] = j

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
      }
    }

    return dp[a.length][b.length]
  }
}

// Вес лексического бонуса в итоговом score (см. searchBySemantic /
// lexicalSimilarity). Подобран так, чтобы перебивать шум на коротких
// запросах (там разрыв между правильным и случайным совпадением обычно
// 0.01-0.03), но не перекрывать настоящий семантический сигнал на длинных
// запросах, где такого шума нет и лексическая близость сама по себе мала.
const LEXICAL_BOOST_WEIGHT = 0.06

// Минимальный итоговый score, ниже которого подсказку вообще не показываем
// (см. searchBySemantic). Подобран по двум реальным замерам с пользователем:
// клавиатурная крякозябра (гарантированно бессмысленный запрос) дала
// максимум 0.838, а уверенное совпадение "ель голубая" → "Саженцы хвойных
// пород" — от 0.861 до 0.90+. 0.85 — с запасом между этими двумя точками.
// Если позже найдётся реальный короткий запрос, у которого верное
// совпадение проваливается ниже 0.85 — порог придётся пересмотреть, тут
// всего две калибровочные точки, не полноценная выборка.
const MIN_SCORE = 0.85
