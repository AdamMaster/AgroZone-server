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
      const score = this.dotProduct(queryVector, item.embedding)
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

    return [...bestByCategory.values()].sort((a, b) => b.score - a.score).slice(0, limit)
  }

  private dotProduct(a: number[], b: number[]): number {
    let sum = 0

    for (let i = 0; i < a.length && i < b.length; i++) {
      sum += a[i] * b[i]
    }

    return sum
  }
}
