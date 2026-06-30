import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { FileService } from '../file/file.service'
import { ConfigService } from '@nestjs/config'
import 'multer'
import { AD_LIMITS } from './constants/ads.constants'
import { CreateAdDto } from './dto/create-ad.dto'
import { AdStatus, Prisma } from 'prisma/generated/client'
import { UpdateAdDto } from './dto/update-ad.dto'
import { AdStateMachineService } from './ad-state-machine.service'
import { FindAdsQueryDto } from './dto/find-ads-query.dto'
import { FindMyAdsQueryDto } from './dto/find-my-ads-query.dto'
import { CategoriesService } from '@/categories/categories.service'
import { randomBytes } from 'crypto'
import slugify from 'slugify'

@Injectable()
export class AdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
    private readonly configService: ConfigService,
    private readonly adStateMachine: AdStateMachineService,
    private readonly categoriesService: CategoriesService
  ) {}

  async create(
    createAdDto: CreateAdDto,
    userId: string,
    files: Express.Multer.File[],
    status: AdStatus = AdStatus.PENDING
  ) {
    await this.validateFileLimits(userId, files)

    const images = await this.prepareImages(null, [], files)

    const categoryPath = await this.categoriesService.getCategoryPath(createAdDto.categoryId)

    const baseSlug = slugify(createAdDto.title, {
      lower: true,
      strict: true
    })
    const uniqueHash = randomBytes(3).toString('hex')
    const slug = `${baseSlug}-${uniqueHash}`
    const seoPath = this.categoriesService.buildSeoPath(categoryPath, slug)

    return this.prisma.ad.create({
      data: {
        ...createAdDto,
        images,
        userId,
        status,
        categoryPath,
        seoPath,
        slug,
        features: (createAdDto.features ?? {}) as Prisma.InputJsonValue
      }
    })
  }

  async findAll(query: FindAdsQueryDto, userId?: string) {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 20, 50)
    const skip = (page - 1) * limit

    const now = new Date()

    // 1. Собираем массив ID категорий для фильтрации
    let categoryIds: string[] | undefined = undefined

    if (query.categoryId) {
      // Рекурсивно собираем ID выбранной категории и всех её потомков
      const result = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE category_tree AS (
        SELECT id FROM categories WHERE id = ${query.categoryId}
        UNION ALL
        SELECT c.id FROM categories c
        INNER JOIN category_tree ct ON c.parent_id = ct.id
      )
      SELECT id FROM category_tree;
    `

      categoryIds = result.map(row => row.id)
    }

    // 2. Делаем основной запрос к объявлениям
    const ads = await this.prisma.ad.findMany({
      where: {
        status: AdStatus.PUBLISHED,
        expiresAt: { gt: now },
        // Если отфильтровано по категории, ищем совпадения по всему дереву ID
        ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),

        // Наш поиск по подстроке (работает, если query.search не пустой)
        ...(query.search
          ? {
              OR: [
                { title: { contains: query.search, mode: 'insensitive' } },
                { description: { contains: query.search, mode: 'insensitive' } }
              ]
            }
          : {})
      },
      include: {
        category: true,
        favorites: userId
          ? {
              where: { userId },
              select: { id: true }
            }
          : false
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    })

    return ads.map(ad => ({
      ...ad,
      isFavorite: userId ? ad.favorites?.length > 0 : false,
      isExpired: false
    }))
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
            name: true,
            avatar: true,
            createdAt: true
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

    return ad
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

    const { existingImages, features, ...rest } = updateAdDto

    const nextStatus = ad.status === AdStatus.PUBLISHED ? AdStatus.PENDING : ad.status

    return this.prisma.ad.update({
      where: { id },
      data: {
        ...rest,
        status: nextStatus,
        rejectionReason: null,
        images,
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

    const hasChanges =
      updateDto &&
      ((updateDto.title !== undefined && updateDto.title !== ad.title) ||
        (updateDto.description !== undefined && updateDto.description !== ad.description) ||
        (updateDto.price !== undefined && Number(updateDto.price) !== Number(ad.price)))

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
          title: updateDto.title,
          description: updateDto.description,
          price: updateDto.price
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
            phone: true
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
        rejectionReason: null // Очищаем причину, так как статус изменился
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
    const { existingImages, features, lat, lng, price, ...rest } = createAdDto

    // Безопасно приводим к числам, чтобы Prisma не ругалась
    const parsedLat = lat ? Number(lat) : 0
    const parsedLng = lng ? Number(lng) : 0
    const parsedPrice = price ? Number(price) : undefined

    if (id) {
      const ad = await this.getUserAdOrThrow(id, userId)
      const images = await this.prepareImages(ad, existingImages || [], files)
      const categoryPath = await this.categoriesService.getCategoryPath(rest.categoryId)

      const slug = slugify(createAdDto.title, {
        lower: true,
        strict: true
      })

      const seoPath = this.categoriesService.buildSeoPath(categoryPath, slug)

      return this.prisma.ad.update({
        where: { id },
        data: {
          ...rest,
          lat: parsedLat,
          lng: parsedLng,
          price: parsedPrice,
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

    const slug = slugify(createAdDto.title, {
      lower: true,
      strict: true
    })

    const seoPath = this.categoriesService.buildSeoPath(categoryPath, slug)

    return this.prisma.ad.create({
      data: {
        ...rest,
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

    if (!ad) {
      throw new NotFoundException('Объявление не найдено')
    }

    const status = this.adStateMachine.transition(ad.status, 'PUBLISH')

    return this.prisma.ad.update({
      where: { id },
      data: {
        status,
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
