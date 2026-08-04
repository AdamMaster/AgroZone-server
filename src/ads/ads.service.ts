import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { FileService } from '../file/file.service'
import { ConfigService } from '@nestjs/config'
import 'multer'
import { AD_LIMITS } from './constants/ads.constants'
import { CreateAdDto } from './dto/create-ad.dto'
import { AdStatus, FeatureType, PriceUnit, Prisma } from 'prisma/generated/client'
import { UpdateAdDto } from './dto/update-ad.dto'
import { AdStateMachineService } from './ad-state-machine.service'
import { AdsSortBy, FindAdsQueryDto } from './dto/find-ads-query.dto'
import { FindMyAdsQueryDto } from './dto/find-my-ads-query.dto'
import { CategoriesService } from '@/categories/categories.service'
import { randomBytes } from 'crypto'
import slugify from 'slugify'
import { UserService } from '@/user/user.service'
import { normalizePhone } from '@/libs/common/utils/phone.util'

@Injectable()
export class AdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
    private readonly configService: ConfigService,
    private readonly adStateMachine: AdStateMachineService,
    private readonly categoriesService: CategoriesService,
    private readonly userService: UserService
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
      phone = user.phones.find(p => p.isPrimary)?.phone ?? null
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

    conditions.push(...featureConditions)

    const sortMap: Record<AdsSortBy, Prisma.Sql> = {
      [AdsSortBy.DATE_DESC]: Prisma.sql`ads.created_at DESC`,
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
            displayName: true
          }
        },
        category: true,
        favorites: userId
          ? {
              where: { userId },
              select: { id: true }
            }
          : false
      },
      orderBy: this.mapSortToPrismaOrderBy(query.sortBy)
    })

    const items = ads.map(ad => ({
      ...ad,
      isFavorite: userId ? ad.favorites?.length > 0 : false,
      isExpired: false
    }))

    return { items, total, page, limit }
  }

  private mapSortToPrismaOrderBy(sortBy?: AdsSortBy) {
    switch (sortBy) {
      case AdsSortBy.DATE_ASC:
        return [{ createdAt: 'asc' as const }]
      case AdsSortBy.PRICE_ASC:
        return [{ price: { sort: 'asc' as const, nulls: 'last' as const } }]
      case AdsSortBy.PRICE_DESC:
        return [{ price: { sort: 'desc' as const, nulls: 'last' as const } }]
      case AdsSortBy.DATE_DESC:
      default:
        return [{ createdAt: 'desc' as const }]
    }
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

  async findOne(id: string) {
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
        }
      }
    })

    if (!ad) {
      throw new NotFoundException('Объявление не найдено')
    }

    const isExpired = ad.expiresAt !== null && ad.expiresAt <= now

    if (ad.status !== AdStatus.PUBLISHED || isExpired) {
      throw new NotFoundException('Объявление не найдено')
    }

    const { user, ...rest } = ad

    let userWithAdsCount: (Omit<NonNullable<typeof user>, '_count'> & { adsCount: number }) | null = null

    if (user) {
      const { _count, ...userRest } = user
      userWithAdsCount = { ...userRest, adsCount: _count.ads }
    }

    return { ...rest, user: userWithAdsCount }
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
      select: { role: true }
    })

    const maxFiles = user?.role === 'PREMIUM' ? AD_LIMITS.PREMIUM : AD_LIMITS.REGULAR

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

    const nextStatus = ad.status === AdStatus.PUBLISHED ? AdStatus.PENDING : ad.status

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

    return this.prisma.ad.update({
      where: { id },
      data: {
        status,
        rejectionReason: reason ?? null
      }
    })
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

  async archive(id: string, userId: string) {
    const ad = await this.getUserAdOrThrow(id, userId)

    if (!ad) {
      throw new NotFoundException('Объявление не найдено')
    }

    const status = this.adStateMachine.transition(ad.status, 'ARCHIVE')

    return this.prisma.ad.update({
      where: { id },
      data: { status }
    })
  }

  async activate(id: string, userId: string) {
    const ad = await this.getUserAdOrThrow(id, userId)
    if (!ad) throw new NotFoundException('Объявление не найдено')

    const nextStatus = this.adStateMachine.transition(ad.status, 'ACTIVATE')

    return this.prisma.ad.update({
      where: { id },
      data: { status: nextStatus }
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
        rejectionReason: null
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
        rejectionReason: null
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
