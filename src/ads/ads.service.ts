import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { FileService } from '../file/file.service'
import { ConfigService } from '@nestjs/config'
import 'multer'
import { AD_LIMITS } from './constants/ads.constants'
import { isPremiumActive } from '@/premium/utils/is-premium-active.util'
import { CreateAdDto } from './dto/create-ad.dto'
import { AdStatus, FeatureType, PriceUnit, Prisma } from '@/generated/prisma/client'
import { UpdateAdDto } from './dto/update-ad.dto'
import { AdStateMachineService } from './ad-state-machine.service'
import { AdsSortBy, FindAdsQueryDto } from './dto/find-ads-query.dto'
import { FindMyAdsQueryDto } from './dto/find-my-ads-query.dto'
import { CategoriesService } from '@/categories/categories.service'
import { randomBytes } from 'crypto'
import slugify from 'slugify'
import { UserService } from '@/user/user.service'
import { normalizePhone } from '@/libs/common/utils/phone.util'
import { NotificationsService } from '@/notifications/notifications.service'

// Города федерального значения — у них DaData отдаёт city == region, из-за
// чего city_fias_id/city_with_type в ответе DaData пустые (см.
// AddressInput.handleAddressChange), и Ad.localityFiasId для таких
// объявлений вообще НЕ заполняется — есть только Ad.region/regionIsoCode.
// Поэтому при выборе такого города из справочника RuCity (у него свой,
// отдельный fiasId — см. ru-cities.ts) фильтровать по locality_fias_id
// бессмысленно: сравниваем по названию региона (ILIKE) вместо этого. ISO
// 3166-2:RU коды регионов мы намеренно не хардкодим (не удалось надёжно
// подтвердить точный формат, см. обсуждение), поэтому не region_iso_code.
const FEDERAL_CITY_REGION_NAMES: Record<string, string> = {
  '0c5b2444-70a0-4932-980c-b4dc0d3f02b5': 'Москва',
  'c2deb16a-0330-4f05-821f-1d09c93331e6': 'Санкт-Петербург',
  '6fdecb78-893a-4e3f-a5ba-aa062459463b': 'Севастополь'
}

// Форматирование подписи региона из полей справочника RuCity (region +
// regionType, взятых из hflabs/city как есть — там region в именительном
// падеже без типа, "Адыгея"/"Респ", а не готовая строка вроде DaData
// region_with_type). Обрабатывает только реально встречающиеся в датасете
// значения regionType (см. ru-cities.ts).
function formatRegionLabel(regionType: string | null, region: string): string {
  switch (regionType) {
    case 'Респ':
      return `Респ. ${region}`
    case 'край':
      return `${region} край`
    case 'обл':
      return `${region} обл.`
    case 'Аобл':
      return `${region} автономная обл.`
    case 'АО':
      return /округ/i.test(region) ? region : `${region} АО`
    case 'Чувашия':
      return `${region} - Чувашия`
    default:
      return region
  }
}

function formatCityLabel(city: {
  city: string
  cityType: string | null
  region: string
  regionType: string | null
  isFederalCity: boolean
}): string {
  // Федеральный город — регион и есть город, дублировать в подписи нечего.
  if (city.isFederalCity) return city.city

  const cityLabel = city.cityType ? `${city.cityType}. ${city.city}` : city.city

  return `${cityLabel}, ${formatRegionLabel(city.regionType, city.region)}`
}

// Регион, выбранный в фильтре (query.regionIsoCode — см. FindAdsQueryDto),
// сравнивается не по ISO-коду (мы намеренно не храним и не хардкодим
// ISO 3166-2:RU — не удалось надёжно подтвердить точный формат, см.
// обсуждение), а по вхождению БАЗОВОГО названия региона (как оно записано
// в справочнике RuCity, например "Алтай" или "Кабардино-Балкарская") в
// Ad.region (человекочитаемая строка вида "Кабардино-Балкарская Респ.",
// см. AddressInput) — этот базовый кусок названия у DaData и hflabs
// совпадает буквально, а тип региона ("Респ"/"край"/"обл", у DaData может
// стоять и до, и после названия) — нет, поэтому в сравнении не участвует.
//
// Матчим ЦЕЛЫМ словом (\y...\y), а не подстрокой — иначе "Алтай" совпал бы
// и внутри "Алтайский край" (проверено на реальном Postgres). Ведущие и
// хвостовые не-буквенные символы обрезаем — у одного региона в датасете
// название вида "Саха /Якутия/", и висящий "/" на конце иначе ломает
// границу слова.
function buildRegionMatchPattern(name: string): string {
  const trimmed = name.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  return `\\y${escaped}\\y`
}

@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
    private readonly configService: ConfigService,
    private readonly adStateMachine: AdStateMachineService,
    private readonly categoriesService: CategoriesService,
    private readonly userService: UserService,
    private readonly notificationsService: NotificationsService
  ) {}

  async create(
    createAdDto: CreateAdDto,
    userId: string,
    files: Express.Multer.File[],
    status: AdStatus = AdStatus.PENDING
  ) {
    await this.validateFileLimits(userId, files)

    const user = await this.userService.findById(userId)

    if (!user) {
      throw new NotFoundException('Пользователь не найден')
    }

    let phone = createAdDto.phone ? normalizePhone(createAdDto.phone) : null

    if (!phone) {
      // Как и в saveDraft() — если основного номера нет, но хотя бы один
      // номер привязан, используем его, а не считаем, что номера нет
      // вовсе (см. обсуждение — UserService.confirmAddPhone раньше мог
      // добавить номер без isPrimary).
      phone = user.phones.find(p => p.isPrimary)?.phone ?? user.phones[0]?.phone ?? null
    }

    if (!phone) {
      throw new BadRequestException('Укажите номер телефона для связи')
    }

    if (!/^\d{10,15}$/.test(phone)) {
      throw new BadRequestException('Некорректный номер телефона')
    }

    const images = await this.prepareImages(null, createAdDto.existingImages ?? [], files)

    const categoryPath = await this.categoriesService.getCategoryPath(createAdDto.categoryId)

    // Единица цены должна быть одной из разрешённых для выбранной
    // категории (Category.priceUnits) — иначе, например, объявление о
    // продаже зерна можно было бы случайно/специально опубликовать с ценой
    // "за час". Категории без явно заданных единиц (priceUnits пуст)
    // трактуем как разрешающие любое значение enum, чтобы не блокировать
    // публикацию из-за неполных сид-данных.
    const category = await this.prisma.category.findUnique({
      where: { id: createAdDto.categoryId },
      select: { priceUnits: true }
    })

    const unit = createAdDto.unit ?? PriceUnit.ITEM

    if (category?.priceUnits?.length && !category.priceUnits.includes(unit)) {
      throw new BadRequestException('Выбранная единица измерения цены недоступна для этой категории')
    }

    const baseSlug =
      slugify(createAdDto.title, {
        lower: true,
        strict: true,
        locale: 'ru'
      }) || 'ad'

    const uniqueHash = randomBytes(3).toString('hex')
    const slug = `${baseSlug}-${uniqueHash}`
    const seoPath = this.categoriesService.buildSeoPath(categoryPath, slug)

    const { existingImages, price, features, ...restDto } = createAdDto

    return this.prisma.ad.create({
      data: {
        ...restDto,
        phone,
        price: price !== undefined && price !== null ? BigInt(Math.round(price)) : null,
        unit,
        images,
        userId,
        status,
        categoryPath,
        seoPath,
        slug,
        features: (features ?? {}) as Prisma.InputJsonValue
      }
    })
  }

  async findAll(query: FindAdsQueryDto, userId?: string) {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 20, 50)
    const skip = (page - 1) * limit

    // Цена "за кг" и "за тонну" — разные величины, поэтому диапазон
    // minPrice/maxPrice всегда действует в рамках одной явно выбранной
    // единицы (см. обсуждение с пользователем): без unit фильтр по цене
    // запрещаем, а не пытаемся молча угадать/сконвертировать.
    if ((query.minPrice !== undefined || query.maxPrice !== undefined) && !query.unit) {
      throw new BadRequestException('Для фильтра по цене нужно указать единицу измерения')
    }

    if (query.minPrice !== undefined && query.maxPrice !== undefined && query.minPrice > query.maxPrice) {
      throw new BadRequestException('Минимальная цена не может быть больше максимальной')
    }

    const featureConditions = query.features ? await this.resolveFeatureFilters(query.categoryId, query.features) : []

    const conditions: Prisma.Sql[] = [
      Prisma.sql`ads.status = ${AdStatus.PUBLISHED}::"AdStatus"`,
      Prisma.sql`ads.expires_at > now()`
    ]

    if (query.categoryId) {
      conditions.push(Prisma.sql`ads.category_id IN (SELECT id FROM category_tree)`)
    }

    if (query.search) {
      const pattern = `%${query.search}%`
      conditions.push(Prisma.sql`(ads.title ILIKE ${pattern} OR ads.description ILIKE ${pattern})`)
    }

    // regionIsoCode (несмотря на название параметра — оставили для
    // совместимости с фронтом/URL) на самом деле несёт базовое название
    // региона из справочника RuCity, а не настоящий ISO-код (мы его не
    // храним — см. buildRegionMatchPattern). Сравниваем целым словом по
    // Ad.region, а не точным совпадением колонки.
    if (query.regionIsoCode) {
      conditions.push(Prisma.sql`ads.region ~* ${buildRegionMatchPattern(query.regionIsoCode)}`)
    }

    if (query.localityFiasId) {
      const federalCityRegionName = FEDERAL_CITY_REGION_NAMES[query.localityFiasId]

      // Москва/СПб/Севастополь выбраны из справочника RuCity — у таких
      // объявлений locality_fias_id не заполняется (см. AddressInput —
      // DaData не отдаёт city_fias_id, когда city == region), поэтому
      // сравниваем по названию региона вместо ФИАС-id.
      conditions.push(
        federalCityRegionName
          ? Prisma.sql`ads.region ~* ${buildRegionMatchPattern(federalCityRegionName)}`
          : Prisma.sql`ads.locality_fias_id = ${query.localityFiasId}`
      )
    }

    if (query.unit && (query.minPrice !== undefined || query.maxPrice !== undefined)) {
      const priceBounds: Prisma.Sql[] = [Prisma.sql`ads.unit = ${query.unit}::"PriceUnit"`]

      if (query.minPrice !== undefined) {
        priceBounds.push(Prisma.sql`ads.price >= ${BigInt(Math.round(query.minPrice))}`)
      }

      if (query.maxPrice !== undefined) {
        priceBounds.push(Prisma.sql`ads.price <= ${BigInt(Math.round(query.maxPrice))}`)
      }

      conditions.push(Prisma.join(priceBounds, ' AND '))
    }

    // Тип продавца хранится на users, а не на ads — раз уж эти запросы уже
    // построены как raw SQL с JOIN-подобными подзапросами (см.
    // category_id/locality_fias_id выше), фильтруем той же подзапросной
    // формой, а не втягиваем сюда декларативный Prisma-where.
    if (query.sellerType) {
      conditions.push(Prisma.sql`ads.user_id IN (SELECT id FROM users WHERE type = ${query.sellerType}::"UserType")`)
    }

    conditions.push(...featureConditions)

    // DATE_DESC (сортировка по умолчанию) — COALESCE(bumped_at, created_at):
    // платно поднятое объявление (см. AdBumpsService) всплывает в топ ленты
    // ровно как только что созданное и естественно "тонет" по мере
    // появления более новых/свежеподнятых объявлений. Явная сортировка по
    // цене/дате намеренно не учитывает bumped_at — поднятие влияет только
    // на дефолтную ленту, а не переупорядочивает то, что юзер явно
    // отсортировал сам.
    const sortMap: Record<AdsSortBy, Prisma.Sql> = {
      [AdsSortBy.DATE_DESC]: Prisma.sql`COALESCE(ads.bumped_at, ads.created_at) DESC`,
      [AdsSortBy.DATE_ASC]: Prisma.sql`ads.created_at ASC`,
      [AdsSortBy.PRICE_ASC]: Prisma.sql`ads.price ASC NULLS LAST`,
      [AdsSortBy.PRICE_DESC]: Prisma.sql`ads.price DESC NULLS LAST`
    }
    const orderBy = sortMap[query.sortBy ?? AdsSortBy.DATE_DESC]

    // Рекурсивное CTE нужно только когда фильтруем по категории (вместе с
    // её подкатегориями) — иначе просто опускаем его.
    const categoryTreeCte = query.categoryId
      ? Prisma.sql`WITH RECURSIVE category_tree AS (
          SELECT id FROM categories WHERE id = ${query.categoryId}
          UNION ALL
          SELECT c.id FROM categories c INNER JOIN category_tree ct ON c.parent_id = ct.id
        )`
      : Prisma.sql``

    const whereClause = Prisma.join(conditions, ' AND ')

    // Считаем total отдельным запросом, а не через COUNT(*) OVER() в одном
    // запросе с LIMIT/OFFSET: если запрошена страница за пределами
    // доступных данных, оконная функция просто не вернёт ни одной строки,
    // и total пришлось бы считать нулём даже когда объявления есть.
    const countRows = await this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      ${categoryTreeCte}
      SELECT COUNT(*) AS count FROM ads WHERE ${whereClause}
    `)

    const total = Number(countRows[0]?.count ?? 0)

    if (!total || skip >= total) {
      return { items: [], total, page, limit }
    }

    const idRows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      ${categoryTreeCte}
      SELECT ads.id FROM ads WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${skip}
    `)

    const ids = idRows.map(row => row.id)

    const ads = await this.prisma.ad.findMany({
      where: { id: { in: ids } },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            // Премиум сам поднимает объявление и выделяет цену (см.
            // PromoteAd/AdCard на фронте — оба эффекта считаются на клиенте
            // как ad.priceHighlightUntil в будущем ИЛИ владелец с активным
            // премиумом), для каталога это поле не было нужно раньше —
            // фронт нигде его тут не показывал.
            premiumUntil: true
          }
        },
        category: true,
        favorites: userId
          ? {
              where: { userId },
              select: { id: true }
            }
          : false
      }
      // Без orderBy — порядок строк из findMany({ where: { id: { in } } })
      // не гарантирован и не обязан совпадать с ORDER BY выше (особенно
      // для COALESCE(bumped_at, created_at), для которого нет прямого
      // аналога в декларативном orderBy Prisma). Правильный порядок уже
      // есть в ids — просто раскладываем найденные записи по нему ниже.
    })

    const adsById = new Map(ads.map(ad => [ad.id, ad]))
    const orderedAds = ids.map(id => adsById.get(id)).filter((ad): ad is (typeof ads)[number] => ad !== undefined)

    const items = orderedAds.map(ad => ({
      ...ad,
      isFavorite: userId ? ad.favorites?.length > 0 : false,
      isExpired: false
    }))

    return { items, total, page, limit }
  }

  // Список локаций для фильтра каталога — гибрид двух источников:
  //  - регионы (респ./край/обл./АО и т.д.) И города — из статичного
  //    справочника RuCity (датасет hflabs/city, тот же источник, что и
  //    DaData), доступны для поиска ВСЕГДА, даже если по ним ещё нет ни
  //    одного объявления (иначе ввод "Красн..."/"Крас..." ничего бы не
  //    подсказывал, пока кто-то не разместит объявление именно там —
  //    ровно это и было нужно: "и города, и республики, и края, и всё
  //    всё всё", а не только то, что уже опубликовано);
  //  - сёла/деревни — по-прежнему из реальных объявлений, отдельной
  //    статичной геобазы для них нет (в датасете их нет, а хардкодить
  //    самим — и политически спорно на некоторых границах, и бесполезно
  //    показывало бы места без единого объявления).
  //
  // Отдаём уровни вперемешку одним списком — так фронт может искать
  // единым полем и по региону целиком ("Кабардино-Балкарская Респ." →
  // все объявления по всему региону), и по конкретному городу/селу
  // ("Нальчик" → только по нему, через ФИАС-id, а не сравнение строк).
  async getAvailableLocations() {
    const now = new Date()

    const baseWhere = {
      status: AdStatus.PUBLISHED,
      expiresAt: { gt: now }
    }

    const [cities, regionRows, localityRows] = await Promise.all([
      // Справочник городов (RuCity, датасет hflabs/city) — не зависит от
      // того, есть ли по городу хоть одно объявление, доступен для
      // поиска всегда (см. ru-cities.ts).
      this.prisma.ruCity.findMany({ orderBy: { city: 'asc' } }),
      // Уникальные регионы того же справочника — те же самые ~85
      // субъектов РФ, что и у городов выше, поэтому регион точно так же
      // доступен для поиска всегда, а не только там, где уже есть
      // объявление.
      this.prisma.ruCity.findMany({
        distinct: ['region'],
        select: { region: true, regionType: true, isFederalCity: true },
        orderBy: { region: 'asc' }
      }),
      this.prisma.ad.findMany({
        where: { ...baseWhere, localityFiasId: { not: null } },
        select: { region: true, regionIsoCode: true, locality: true, localityFiasId: true },
        distinct: ['localityFiasId'],
        orderBy: { locality: 'asc' }
      })
    ])

    const citiesFromReference = cities.map(city => ({
      type: 'locality' as const,
      label: formatCityLabel(city),
      regionIsoCode: undefined,
      localityFiasId: city.fiasId
    }))

    // Москва/СПб/Севастополь в RuCity одновременно "город" и "регион"
    // (region === city, см. ru-cities.ts) — как отдельный пункт "регион"
    // их не показываем, они уже есть выше в citiesFromReference, и это и
    // есть выбор "весь регион" для них (весь федеральный город).
    const regions = regionRows
      .filter(region => !region.isFederalCity)
      .map(region => ({
        type: 'region' as const,
        label: formatRegionLabel(region.regionType, region.region),
        regionIsoCode: region.region
      }))

    const cityFiasIds = new Set(cities.map(city => city.fiasId))

    // Сёла/деревни и прочие населённые пункты — их нет в справочнике
    // городов (RuCity содержит только города), поэтому как и раньше берём
    // их из реальных объявлений. Города, которые объявление указало точно
    // так же, как уже есть в справочнике, пропускаем — не дублировать.
    const localities = localityRows
      .filter(
        (row): row is { region: string; regionIsoCode: string; locality: string; localityFiasId: string } =>
          Boolean(row.region && row.regionIsoCode && row.locality && row.localityFiasId)
      )
      .filter(row => !cityFiasIds.has(row.localityFiasId))
      .map(row => ({
        type: 'locality' as const,
        label: `${row.locality}, ${row.region}`,
        regionIsoCode: row.regionIsoCode,
        localityFiasId: row.localityFiasId
      }))

    return [...regions, ...citiesFromReference, ...localities]
  }


  // Строит SQL-условия для фильтра по динамическим характеристикам
  // категории (Ad.features, JSONB). Ключи в rawFeatures сверяются с
  // реальными CategoryFeature этой категории — неизвестные, нефильтруемые
  // или устаревшие (например, категория поменялась, а в адресной строке
  // остался старый параметр) тихо игнорируются, а не роняют весь запрос.
  private async resolveFeatureFilters(categoryId: string | undefined, rawFeatures: string): Promise<Prisma.Sql[]> {
    if (!categoryId) {
      throw new BadRequestException('Фильтрация по характеристикам доступна только внутри конкретной категории')
    }

    let parsed: unknown

    try {
      parsed = JSON.parse(rawFeatures)
    } catch {
      throw new BadRequestException('Некорректный формат параметра features')
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new BadRequestException('Некорректный формат параметра features')
    }

    const requested = parsed as Record<string, unknown>

    const definitions = await this.prisma.categoryFeature.findMany({
      where: { categoryId, filterable: true }
    })

    const byName = new Map(definitions.map(definition => [definition.name, definition]))

    const conditions: Prisma.Sql[] = []

    for (const [key, value] of Object.entries(requested)) {
      const definition = byName.get(key)

      if (!definition) continue

      switch (definition.type) {
        case FeatureType.NUMBER: {
          if (typeof value !== 'object' || value === null || Array.isArray(value)) break

          const { min, max } = value as { min?: unknown; max?: unknown }

          // Значения хранятся как JSON-число, но ->>'ключ' достаёт их
          // текстом — на случай "грязных" исторических данных сверяем
          // регуляркой перед ::numeric, чтобы битое значение у одного
          // объявления не роняло весь запрос ошибкой каста.
          const numericGuard = Prisma.sql`ads.features->>${key} ~ '^-?[0-9]+(\\.[0-9]+)?$'`

          if (typeof min === 'number' && Number.isFinite(min)) {
            conditions.push(Prisma.sql`(${numericGuard} AND (ads.features->>${key})::numeric >= ${min})`)
          }

          if (typeof max === 'number' && Number.isFinite(max)) {
            conditions.push(Prisma.sql`(${numericGuard} AND (ads.features->>${key})::numeric <= ${max})`)
          }

          break
        }

        case FeatureType.BOOLEAN: {
          if (typeof value !== 'boolean') break
          conditions.push(Prisma.sql`ads.features->>${key} = ${String(value)}`)
          break
        }

        case FeatureType.SELECT: {
          if (!Array.isArray(value) || !value.length) break

          const allowedOptions = Array.isArray(definition.options) ? (definition.options as string[]) : []
          const values = value.filter((v): v is string => typeof v === 'string' && allowedOptions.includes(v))

          if (!values.length) break

          conditions.push(Prisma.sql`ads.features->>${key} IN (${Prisma.join(values)})`)
          break
        }

        case FeatureType.MULTI_SELECT: {
          if (!Array.isArray(value) || !value.length) break

          const allowedOptions = Array.isArray(definition.options) ? (definition.options as string[]) : []
          const values = value.filter((v): v is string => typeof v === 'string' && allowedOptions.includes(v))

          if (!values.length) break

          conditions.push(Prisma.sql`ads.features->${key} ?| ARRAY[${Prisma.join(values)}]::text[]`)
          break
        }

        case FeatureType.TEXT:
        default:
          // Свободный текст сознательно не фильтруем в v1 — после аудита
          // categories.ts большинство текстовых полей уже filterable:
          // false, а для оставшихся точное совпадение малополезно
          // (нужен был бы полнотекстовый поиск, это отдельная задача).
          break
      }
    }

    return conditions
  }

  async findMyAds(userId: string, query: FindMyAdsQueryDto) {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 20, 50)
    const skip = (page - 1) * limit

    const ads = await this.prisma.ad.findMany({
      where: {
        userId,
        ...(query.status ? { status: query.status } : {})
      },
      orderBy: { createdAt: 'desc' },
      include: { category: true },
      skip,
      take: limit
    })

    const now = new Date()

    return ads.map(ad => ({
      ...ad,
      isExpired: ad.expiresAt ? ad.expiresAt <= now : false
    }))
  }

  // userId опционален — эндпоинт публичный (доступен без авторизации), но
  // если сессия есть, нужно посчитать isFavorite именно для этого юзера.
  // Раньше userId сюда вообще не передавался, и это поле не отдавалось в
  // ответе — карточка объявления никогда не показывала, что оно уже в
  // избранном, даже у залогиненного и реально добавившего его пользователя.
  async findOne(id: string, userId?: string, viewerKey?: string, trackView = false) {
    const now = new Date()

    const ad = await this.prisma.ad.findUnique({
      where: { id },
      include: {
        category: true,
        user: {
          select: {
            id: true,
            displayName: true,
            picture: true,
            createdAt: true,
            type: true,
            // Готовое к показу название из DaData ("ИП Иванов И.И." /
            // "ООО РОМАШКА") — заполнено только если продавец подтвердил
            // ИП/компанию через ИНН (см. UserService.verifyBusiness).
            // Фронт показывает его вместо самозаявленного типа только
            // когда businessVerifiedAt действительно есть (см. AdDetail) —
            // тут это отдельно не проверяем, просто отдаём как есть.
            businessName: true,
            businessVerifiedAt: true,
            // Для бейджа "Премиум" рядом с именем продавца на публичной
            // карточке (см. AdDetail) — фронт сам решает, активен ли он
            // прямо сейчас (premiumUntil > now), тут просто отдаём сырое
            // значение, без is-premium-active.util (та утилита серверная,
            // фронту нужна своя копия проверки — см. isPremiumActive в
            // client/src/shared/utils/user.util.ts).
            premiumUntil: true,
            // Считаем ДРУГИЕ активные объявления продавца прямо в этом же
            // запросе (filtered relation count), без отдельного round-trip
            // к базе. Фильтр совпадает с условием "объявление видно
            // публично": опубликовано и не просрочено, плюс исключаем само
            // текущее объявление — фронту нужно число "ещё объявлений", а
            // не "всего объявлений включая это".
            _count: {
              select: {
                ads: {
                  where: {
                    status: AdStatus.PUBLISHED,
                    expiresAt: { gt: now },
                    id: { not: id }
                  }
                }
              }
            }
          }
        },
        // Тот же приём, что и в findAll: тянем связь с избранным только
        // если известен userId, иначе просто не запрашиваем её.
        favorites: userId
          ? {
              where: { userId },
              select: { id: true }
            }
          : false
      }
    })

    if (!ad) {
      throw new NotFoundException('Объявление не найдено')
    }

    const isExpired = ad.expiresAt !== null && ad.expiresAt <= now

    if (ad.status !== AdStatus.PUBLISHED || isExpired) {
      throw new NotFoundException('Объявление не найдено')
    }

    // Не блокируем ответ записью статистики — посетитель должен увидеть
    // объявление в любом случае, даже если запись просмотра не удастся (см.
    // recordView). Владельца, смотрящего своё же объявление, не считаем.
    // trackView=false — SSR-вызов (см. AdsController.findOne), у него нет ни
    // реальной сессии, ни реального IP/UA посетителя, поэтому запись оттуда
    // была бы либо мимо владельца, либо схлопывала бы всех посетителей в
    // один viewerKey. Пишем статистику только по настоящему клиентскому
    // запросу.
    if (trackView && viewerKey && ad.userId !== userId) {
      void this.recordView(id, viewerKey)
    }

    const { user, favorites, ...rest } = ad

    let userWithAdsCount: (Omit<NonNullable<typeof user>, '_count'> & { adsCount: number }) | null = null

    if (user) {
      const { _count, ...userRest } = user
      userWithAdsCount = { ...userRest, adsCount: _count.ads }
    }

    return { ...rest, user: userWithAdsCount, isFavorite: userId ? (favorites?.length ?? 0) > 0 : false }
  }

  private async recordView(adId: string, viewerKey: string) {
    try {
      const viewDate = new Date()
      viewDate.setHours(0, 0, 0, 0)

      await this.prisma.adView.create({ data: { adId, viewerKey, viewDate } })
    } catch (error) {
      // P2002 — уникальный индекс (adId, viewerKey, viewDate): повторный
      // просмотр того же посетителя в тот же день, это ожидаемо и не
      // ошибка (см. схему AdView). Остальные сбои не должны ронять показ
      // объявления посетителю — оно уже отдано, статистика подождёт до
      // следующего просмотра.
      if ((error as { code?: string })?.code !== 'P2002') {
        this.logger.error(`Не удалось записать просмотр объявления ${adId}`, error)
      }
    }
  }

  // Максимум недель назад, которые можно пролистать (0 — текущая неделя) —
  // 12 недель всего вместе с текущей. Не про экономию базы (AdViewDaily и
  // так копеечная, живёт по каскаду с самим объявлением) — просто
  // объявления обычно не живут дольше пары месяцев, листать статистику на
  // полгода назад не нужно (см. обсуждение).
  private readonly MAX_WEEK_OFFSET = 11

  // Статистика просмотров — приватная (см. обсуждение и schema.prisma):
  // владелец видит через getViewStatsForOwner, админ — через
  // getViewStatsForAdmin, оба зовут один и тот же приватный getViewStats
  // после своей собственной проверки доступа.
  async getViewStatsForOwner(adId: string, userId: string, weekOffset: number) {
    const ad = await this.getUserAdOrThrow(adId, userId)

    return this.getViewStats(adId, weekOffset, ad.publishedAt)
  }

  async getViewStatsForAdmin(adId: string, weekOffset: number) {
    const ad = await this.prisma.ad.findUnique({ where: { id: adId }, select: { id: true, publishedAt: true } })

    if (!ad) {
      throw new NotFoundException('Объявление не найдено')
    }

    return this.getViewStats(adId, weekOffset, ad.publishedAt)
  }

  // Компактные счётчики для владельца — общее число просмотров за всё
  // время, просмотры за сегодня и число добавлений в избранное. Отдельно
  // от getViewStatsForOwner (та отдаёт недельный график) — это лёгкий
  // запрос для панели над фото на странице объявления (см. обсуждение с
  // пользователем), без разбивки по дням.
  async getCountersForOwner(adId: string, userId: string) {
    await this.getUserAdOrThrow(adId, userId)

    return this.getCounters(adId)
  }

  private async getCounters(adId: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [favoritesCount, viewsAggregate, todayRolledUp, todayRaw] = await Promise.all([
      this.prisma.favorite.count({ where: { adId } }),
      this.prisma.adViewDaily.aggregate({ where: { adId }, _sum: { views: true } }),
      // Сегодняшний день обычно ещё не свёрнут (AdViewsRollupWorker крутится
      // ночью, см. getViewStats выше) — rolledUp тут почти всегда null, но
      // на случай если воркер уже отработал (например, время на сервере
      // "перевалило" за полночь между двумя вызовами), не складываем его с
      // сырыми записями, а берём максимум — иначе задвоили бы просмотры за
      // сегодня, ровно та же защита от двойного счёта, что и в getViewStats.
      this.prisma.adViewDaily.findUnique({
        where: { adId_date: { adId, date: today } },
        select: { views: true }
      }),
      this.prisma.adView.count({ where: { adId, viewDate: today } })
    ])

    const viewsToday = Math.max(todayRolledUp?.views ?? 0, todayRaw)
    const viewsTotal = (viewsAggregate._sum.views ?? 0) + (todayRolledUp ? 0 : todayRaw)

    return { viewsTotal, viewsToday, favoritesCount }
  }

  // Неделя — понедельник-воскресенье (тот же принцип, что у большинства
  // маркетплейсов). weekOffset считаем от текущей недели: 0 — она и есть,
  // 1 — прошлая, и так далее, зажимаем в [0, maxWeekOffset], где
  // maxWeekOffset — не просто константа MAX_WEEK_OFFSET, а она же
  // дополнительно урезанная возрастом самого объявления (см.
  // computeMaxWeekOffset) — иначе можно было пролистать в недели, которые
  // существовали ДО публикации объявления (там заведомо пусто, но кнопка
  // "назад" оставалась активной — баг, замеченный пользователем).
  private async getViewStats(adId: string, weekOffset: number, publishedAt: Date | null) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // getDay(): 0 — воскресенье, 1 — понедельник... приводим к "0 — понедельник".
    const daysSinceMonday = (today.getDay() + 6) % 7
    const currentWeekStart = new Date(today)
    currentWeekStart.setDate(currentWeekStart.getDate() - daysSinceMonday)

    const maxWeekOffset = this.computeMaxWeekOffset(currentWeekStart, publishedAt)
    const clampedOffset = Math.min(Math.max(weekOffset, 0), maxWeekOffset)

    const weekStart = new Date(currentWeekStart)
    weekStart.setDate(weekStart.getDate() - clampedOffset * 7)

    const weekDates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart)
      date.setDate(date.getDate() + index)
      return date
    })

    const [rolledUp, rawViews] = await Promise.all([
      this.prisma.adViewDaily.findMany({
        where: { adId, date: { gte: weekStart, lte: weekDates[6] } },
        select: { date: true, views: true }
      }),
      // Не полагаемся на то, что AdViewsRollupWorker гарантированно
      // отработал этой ночью (кроном в 2:00) — если сервер в этот момент
      // был выключен/перезапускался (обычное дело на деве), сворачивание
      // просто не произошло, и пропущенный день навсегда выпадал бы из
      // ответа, хотя сами просмотры никуда не делись и всё ещё лежат в
      // AdView (баг, замеченный пользователем). Поэтому досчитываем сырые
      // записи не только за сегодня, а за ВСЮ запрошенную неделю — для уже
      // свёрнутых дней тут будет 0 (их raw-строки удаляются транзакционно
      // вместе со сверткой, см. AdViewsRollupWorker), так что суммирование
      // с rolledUp ниже не даёт двойного счёта. Благодаря уникальному
      // индексу (adId, viewerKey, viewDate) на AdView обычный count уже
      // равен числу уникальных посетителей за день, без distinct.
      this.prisma.adView.groupBy({
        by: ['viewDate'],
        where: { adId, viewDate: { gte: weekStart, lte: weekDates[6] } },
        _count: { _all: true }
      })
    ])

    const rolledUpByDate = new Map(rolledUp.map(row => [row.date.toISOString().slice(0, 10), row.views]))
    const rawByDate = new Map(rawViews.map(row => [row.viewDate.toISOString().slice(0, 10), row._count._all]))

    // Будущие дни текущей недели (ещё не наступили) — 0 в обеих картах,
    // ничего специально обрабатывать не нужно.
    const days = weekDates.map(date => {
      const iso = date.toISOString().slice(0, 10)
      const views = (rolledUpByDate.get(iso) ?? 0) + (rawByDate.get(iso) ?? 0)

      return { date: iso, views }
    })

    return {
      weekStart: weekDates[0].toISOString().slice(0, 10),
      weekEnd: weekDates[6].toISOString().slice(0, 10),
      weekOffset: clampedOffset,
      maxWeekOffset,
      total: days.reduce((sum, day) => sum + day.views, 0),
      days
    }
  }

  // Сколько недель назад реально можно пролистать для конкретного
  // объявления — минимум из глобального потолка (MAX_WEEK_OFFSET, см. выше)
  // и возраста самого объявления. publishedAt может быть null (объявление
  // ещё ни разу не публиковалось — например, всё ещё черновик, владелец
  // мог дёрнуть эндпоинт статистики и для такого) — тогда прошлых недель
  // просто нет, 0. currentWeekStart уже приведён к полуночи понедельника
  // текущей недели вызывающим кодом.
  private computeMaxWeekOffset(currentWeekStart: Date, publishedAt: Date | null): number {
    if (!publishedAt) return 0

    const publishedDate = new Date(publishedAt)
    publishedDate.setHours(0, 0, 0, 0)

    const publishedDaysSinceMonday = (publishedDate.getDay() + 6) % 7
    const publishedWeekStart = new Date(publishedDate)
    publishedWeekStart.setDate(publishedWeekStart.getDate() - publishedDaysSinceMonday)

    const weeksSincePublished = Math.round(
      (currentWeekStart.getTime() - publishedWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
    )

    return Math.min(this.MAX_WEEK_OFFSET, Math.max(weeksSincePublished, 0))
  }

  async findOneForOwner(id: string, userId: string) {
    const ad = await this.prisma.ad.findFirst({
      where: {
        id,
        userId
      },
      include: {
        category: true
      }
    })

    if (!ad) {
      throw new NotFoundException('Объявление не найдено')
    }

    return ad
  }

  private async getUserAdOrThrow(id: string, userId: string) {
    const ad = await this.prisma.ad.findFirst({
      where: { id, userId }
    })

    if (!ad) {
      throw new NotFoundException('Объявление не найдено')
    }

    return ad
  }

  private async validateFileLimits(userId: string, files: Express.Multer.File[]) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { premiumUntil: true }
    })

    // Раньше сверялись с role === 'PREMIUM' — устарело: премиум теперь
    // покупается через PremiumService и хранится в premiumUntil, role в
    // этом не участвует (см. schema.prisma).
    const maxFiles = isPremiumActive(user?.premiumUntil) ? AD_LIMITS.PREMIUM : AD_LIMITS.REGULAR

    if ((files?.length ?? 0) > maxFiles) {
      throw new BadRequestException(`Вы можете загрузить не более ${maxFiles} фото`)
    }
  }

  private async deleteImagesFromS3(imageUrls: string[]) {
    const bucketName = this.configService.getOrThrow<string>('S3_BUCKET_NAME')
    const deletePromises = imageUrls.map(url => {
      const fileId = url.split(`${bucketName}/`)[1]
      return fileId ? this.fileService.deleteFile(fileId) : Promise.resolve()
    })
    await Promise.all(deletePromises)
  }

  private async prepareImages(
    ad: { images: string[] } | null,
    existingImages: string[],
    newFiles: Express.Multer.File[]
  ): Promise<string[]> {
    let images = ad?.images || []

    // Удаление старых
    const toDelete = images.filter(img => !existingImages.includes(img))
    if (toDelete.length) await this.deleteImagesFromS3(toDelete)

    images = existingImages

    // Загрузка новых
    if (newFiles?.length) {
      const uploaded = await Promise.all(newFiles.map(f => this.fileService.uploadFile(f, 'ads')))
      images = [...images, ...uploaded.map(r => r.url)]
    }
    return images
  }

  async update(id: string, updateAdDto: UpdateAdDto, userId: string, files?: Express.Multer.File[]) {
    await this.validateFileLimits(userId, files ?? [])

    const ad = await this.getUserAdOrThrow(id, userId)

    if (!ad) {
      throw new NotFoundException('Объявление не найдено')
    }

    let images = ad.images

    if (updateAdDto.existingImages) {
      const remaining = updateAdDto.existingImages

      const toDelete = ad.images.filter(img => !remaining.includes(img))

      if (toDelete.length) {
        await this.deleteImagesFromS3(toDelete)
      }

      images = remaining
    }

    if (files?.length) {
      const uploaded = await Promise.all(files.map(f => this.fileService.uploadFile(f, 'ads')))

      images = [...images, ...uploaded.map(r => r.url)]
    }

    const { existingImages, features, phone, ...rest } = updateAdDto

    let normalizedPhone = phone

    if (phone !== undefined) {
      normalizedPhone = normalizePhone(phone)

      if (!normalizedPhone) {
        throw new BadRequestException('Некорректный номер телефона')
      }
    }

    // PUBLISHED после правок уходит на повторную модерацию — уже было так.
    // REJECTED — та же логика (и тот же переход REJECTED -> PENDING, что
    // разрешён в AdStateMachineService по действию ACTIVATE): раз продавец
    // специально зашёл поправить отклонённое объявление и жмёт "Сохранить",
    // это и есть намерение отправить его на повторную проверку. Без этого
    // объявление молча остаётся REJECTED навсегда — оно пропадает из
    // очереди модератора (findPending видит только PENDING) и никаким
    // действием на этой странице обратно вернуть его было нельзя (см.
    // обсуждение с пользователем).
    const nextStatus =
      ad.status === AdStatus.PUBLISHED || ad.status === AdStatus.REJECTED ? AdStatus.PENDING : ad.status

    return this.prisma.ad.update({
      where: { id },
      data: {
        ...rest,
        status: nextStatus,
        rejectionReason: null,
        images,
        ...(normalizedPhone !== undefined && {
          phone: normalizedPhone
        }),
        features: features ? (features as Prisma.InputJsonValue) : undefined
      }
    })
  }

  async getAddressFromCoords(lat: number, lon: number): Promise<string> {
    const apiKey = this.configService.getOrThrow<string>('YANDEX_MAPS_API_KEY')
    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${lon},${lat}&format=json&results=1`

    const response = await fetch(url)
    const data = await response.json()

    const address =
      data.response.GeoObjectCollection.featureMember[0]?.GeoObject?.metaDataProperty?.GeocoderMetaData?.text

    return address || 'Адрес не найден'
  }

  private getExpirationDateFrom(date: Date, days = 30) {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  }

  async publish(id: string) {
    const ad = await this.prisma.ad.findUnique({ where: { id } })

    if (!ad) {
      throw new NotFoundException('Объявление не найдено')
    }

    const now = new Date()
    const expiresAt = this.getExpirationDateFrom(now, 30)

    const status = this.adStateMachine.transition(ad.status, 'PUBLISH')

    const updated = await this.prisma.ad.update({
      where: { id },
      data: {
        status,
        publishedAt: now,
        expiresAt,
        rejectionReason: null
      }
    })

    return updated
  }

  async republish(id: string, userId: string, updateDto?: UpdateAdDto) {
    const ad = await this.getUserAdOrThrow(id, userId)

    if (!ad) throw new NotFoundException('Объявление не найдено')

    const normalizedPhone = updateDto?.phone !== undefined ? normalizePhone(updateDto.phone) : undefined

    if (normalizedPhone !== undefined && !normalizedPhone) {
      throw new BadRequestException('Некорректный номер телефона')
    }

    const hasChanges =
      updateDto &&
      ((updateDto.title !== undefined && updateDto.title !== ad.title) ||
        (updateDto.description !== undefined && updateDto.description !== ad.description) ||
        (updateDto.price !== undefined && Number(updateDto.price) !== Number(ad.price)) ||
        (normalizedPhone !== undefined && normalizedPhone !== ad.phone))

    const now = new Date()

    const nextStatus = hasChanges ? AdStatus.PENDING : AdStatus.PUBLISHED

    return this.prisma.ad.update({
      where: { id },
      data: {
        status: nextStatus,
        publishedAt: now,
        expiresAt: this.getExpirationDateFrom(now, 30),
        rejectionReason: null,
        ...(hasChanges && {
          title: updateDto?.title,
          description: updateDto?.description,
          price: updateDto?.price !== undefined ? BigInt(Math.round(updateDto.price)) : undefined,
          ...(normalizedPhone !== undefined && {
            phone: normalizedPhone
          })
        })
      }
    })
  }

  async reject(id: string, reason?: string) {
    const ad = await this.prisma.ad.findUnique({
      where: { id }
    })

    if (!ad) {
      throw new NotFoundException('Объявление не найдено')
    }

    if (ad.status === AdStatus.REJECTED) {
      throw new BadRequestException('Объявление уже отклонено')
    }

    if (ad.status === AdStatus.PUBLISHED || ad.status === AdStatus.EXPIRED) {
      throw new BadRequestException('Нельзя отклонить опубликованное или истёкшее объявление')
    }

    const status = this.adStateMachine.transition(ad.status, 'REJECT')

    const updatedAd = await this.prisma.ad.update({
      where: { id },
      data: {
        status,
        rejectionReason: reason ?? null
      }
    })

    // Раньше об отклонении продавец узнавал, только если сам заходил в
    // "Мои объявления" и замечал иконку с причиной (см. обсуждение с
    // пользователем) — теперь дополнительно кладём уведомление. Намеренно
    // не оборачиваем в try/catch: если запись уведомления не создалась,
    // лучше явно увидеть ошибку 500 и разобраться, чем молча оставить
    // продавца без единственного способа узнать о решении модератора.
    await this.notificationsService.notifyAdRejected(ad.userId, ad.id, ad.title, reason ?? null)

    return updatedAd
  }

  async findPending(page = 1, limit = 20) {
    const take = Math.min(limit, 50)
    const skip = (page - 1) * take

    return this.prisma.ad.findMany({
      where: {
        status: AdStatus.PENDING
      },
      include: {
        category: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            phones: {
              where: {
                isPrimary: true
              },
              take: 1,
              select: {
                phone: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      },
      skip,
      take
    })
  }

  // Полная карточка объявления для предпросмотра модератором — в отличие
  // от публичного findOne, НЕ ограничена статусом PUBLISHED (модератору
  // как раз нужно смотреть PENDING, а в будущем возможно и любые другие),
  // доступ ограничивается ролью на уровне контроллера (@Roles(ADMIN) +
  // RolesGuard), а не статусом объявления. Контактные данные продавца — те
  // же самые, что и в findPending (email + основной телефон напрямую, без
  // "показать телефон" как на публичной странице): модератору нужно уметь
  // связаться с продавцом, а не защищать его от спама.
  async findOneForModeration(id: string) {
    const ad = await this.prisma.ad.findUnique({
      where: { id },
      include: {
        category: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            phones: {
              where: { isPrimary: true },
              take: 1,
              select: { phone: true }
            }
          }
        }
      }
    })

    if (!ad) {
      throw new NotFoundException('Объявление не найдено')
    }

    return ad
  }

  async archive(id: string, userId: string) {
    const ad = await this.getUserAdOrThrow(id, userId)

    if (!ad) {
      throw new NotFoundException('Объявление не найдено')
    }

    const status = this.adStateMachine.transition(ad.status, 'ARCHIVE')

    return this.prisma.ad.update({
      where: { id },
      // archivedAt — момент, от которого AdsArchivePurgeWorker отсчитывает
      // 30 дней хранения в архиве (см. schema.prisma, комментарий у поля).
      data: { status, archivedAt: new Date() }
    })
  }

  async activate(id: string, userId: string) {
    const ad = await this.getUserAdOrThrow(id, userId)
    if (!ad) throw new NotFoundException('Объявление не найдено')

    const nextStatus = this.adStateMachine.transition(ad.status, 'ACTIVATE')

    return this.prisma.ad.update({
      where: { id },
      // Объявление покинуло архив (если вообще было в нём) — сбрасываем
      // archivedAt, иначе на нём осталась бы старая дата и оно могло бы
      // попасть под очистку при повторной архивации раньше времени.
      data: { status: nextStatus, archivedAt: null }
    })
  }

  async draft(id: string, userId: string) {
    const ad = await this.getUserAdOrThrow(id, userId)
    if (!ad) throw new NotFoundException('Объявление не найдено')

    const status = this.adStateMachine.transition(ad.status, 'DRAFT')

    return this.prisma.ad.update({
      where: { id },
      data: {
        status,
        rejectionReason: null,
        archivedAt: null
      }
    })
  }

  async saveDraft(
    userId: string,
    createAdDto: CreateAdDto & { existingImages?: string[] },
    files: Express.Multer.File[],
    id?: string
  ) {
    await this.validateFileLimits(userId, files)

    const user = await this.userService.findById(userId)

    if (!user) {
      throw new NotFoundException('Пользователь не найден')
    }

    const { existingImages, features, lat, lng, price, phone, ...rest } = createAdDto

    let normalizedPhone = phone ? normalizePhone(phone) : null

    if (phone && !normalizedPhone) {
      throw new BadRequestException('Некорректный номер телефона')
    }


    if (!normalizedPhone) {
      normalizedPhone = user.phones.find(phone => phone.isPrimary)?.phone ?? user.phones[0]?.phone ?? null

      if (!normalizedPhone) {
        throw new BadRequestException('Укажите номер телефона для связи')
      }
    }

    const parsedLat = lat !== undefined ? Number(lat) : 0
    const parsedLng = lng !== undefined ? Number(lng) : 0

    const parsedPrice = price !== undefined && price !== null ? BigInt(Math.round(Number(price))) : undefined

    if (id) {
      const ad = await this.getUserAdOrThrow(id, userId)

      const images = await this.prepareImages(ad, existingImages ?? ad.images, files)

      const categoryPath = rest.categoryId
        ? await this.categoriesService.getCategoryPath(rest.categoryId)
        : ad.categoryPath

      const seoPath = this.categoriesService.buildSeoPath(categoryPath, ad.slug)

      return this.prisma.ad.update({
        where: { id },
        data: {
          ...rest,
          phone: normalizedPhone,
          lat: parsedLat,
          lng: parsedLng,
          price: price !== undefined ? parsedPrice : undefined,
          images,
          status: AdStatus.DRAFT,
          rejectionReason: null,
          features: features ? (features as Prisma.InputJsonValue) : {},
          categoryPath,
          seoPath
        }
      })
    }

    const images = await this.prepareImages(null, [], files)

    const categoryPath = await this.categoriesService.getCategoryPath(rest.categoryId)

    const baseSlug =
      slugify(createAdDto.title ?? '', {
        lower: true,
        strict: true,
        locale: 'ru'
      }) || 'ad'

    const slug = `${baseSlug}-${randomBytes(3).toString('hex')}`

    const seoPath = this.categoriesService.buildSeoPath(categoryPath, slug)

    return this.prisma.ad.create({
      data: {
        ...rest,
        phone: normalizedPhone,
        lat: parsedLat,
        lng: parsedLng,
        price: parsedPrice,
        images,
        userId,
        status: AdStatus.DRAFT,
        features: features ? (features as Prisma.InputJsonValue) : {},
        slug,
        categoryPath,
        seoPath
      }
    })
  }

  async publishDraft(id: string, userId: string) {
    const ad = await this.getUserAdOrThrow(id, userId)

    const status = this.adStateMachine.transition(ad.status, 'PUBLISH')

    const now = new Date()

    return this.prisma.ad.update({
      where: { id },
      data: {
        status,
        publishedAt: now,
        expiresAt: this.getExpirationDateFrom(now, 30),
        rejectionReason: null,
        // PUBLISH из ARCHIVED — тоже выход из архива, см. комментарий в activate().
        archivedAt: null
      }
    })
  }

  async addFavorite(userId: string, adId: string) {
    try {
      await this.prisma.favorite.create({
        data: {
          userId,
          adId
        }
      })

      return { success: true }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P2002':
            throw new ConflictException('Объявление уже есть в избранном')

          case 'P2003':
            throw new NotFoundException('Объявление не найдено')
        }
      }

      throw error
    }
  }

  async removeFavorite(userId: string, adId: string) {
    try {
      await this.prisma.favorite.delete({
        where: {
          userId_adId: {
            userId,
            adId
          }
        }
      })

      return { success: true }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Избранное не найдено')
      }

      throw error
    }
  }

  async getFavorites(userId: string, page = 1, limit = 20) {
    const favorites = await this.prisma.favorite.findMany({
      where: {
        userId
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        ad: {
          select: {
            id: true,
            title: true,
            price: true,
            createdAt: true,
            images: true,
            address: true,
            user: {
              select: {
                id: true,
                displayName: true
              }
            }
          }
        }
      }
    })

    return favorites.map(({ ad }) => ad)
  }

  async remove(id: string, userId: string) {
    const ad = await this.getUserAdOrThrow(id, userId)

    if (!ad) {
      throw new NotFoundException('Объявление не найдено')
    }

    if (ad.images?.length) {
      await this.deleteImagesFromS3(ad.images)
    }

    await this.prisma.ad.delete({
      where: { id }
    })

    return { success: true }
  }
}
