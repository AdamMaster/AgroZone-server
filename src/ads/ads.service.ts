import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { FileService } from '../file/file.service'
import { ConfigService } from '@nestjs/config'
import 'multer'
import { AD_LIMITS } from './constants/ads.constants'
import { CreateAdDto } from './dto/create-ad.dto'
import { AdStatus, Prisma } from 'prisma/generated/client'
import { UpdateAdDto } from './dto/update-ad.dto'

@Injectable()
export class AdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
    private readonly configService: ConfigService
  ) {}

  async create(createAdDto: CreateAdDto, userId: string, files: Express.Multer.File[]) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    })

    const isPremium = user?.role === 'PREMIUM'

    const maxFiles = isPremium ? AD_LIMITS.PREMIUM : AD_LIMITS.REGULAR

    if (files && files.length > maxFiles) {
      throw new BadRequestException(
        `Вы можете загрузить не более ${maxFiles} фотографий. ${
          !isPremium ? 'Приобретите Premium, чтобы загружать до 10 фото.' : ''
        }`
      )
    }

    const imageUrls: string[] = []

    if (files && files.length > 0) {
      const uploadPromises = files.map(file => this.fileService.uploadFile(file, 'ads'))
      const uploadResults = await Promise.all(uploadPromises)

      uploadResults.forEach(result => imageUrls.push(result.url))
    }

    return this.prisma.ad.create({
      data: {
        categoryId: createAdDto.categoryId,
        title: createAdDto.title,
        description: createAdDto.description,
        price: createAdDto.price ?? null,
        images: imageUrls,
        address: createAdDto.address,
        lat: createAdDto.lat,
        lng: createAdDto.lng,
        features: (createAdDto.features ?? {}) as Prisma.InputJsonValue,
        userId,
        status: AdStatus.PENDING
      }
    })
  }

  async findAll(categoryId?: string) {
    return this.prisma.ad.findMany({
      where: {
        status: AdStatus.PUBLISHED,
        ...(categoryId ? { categoryId } : {})
      },
      include: {
        category: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
  }

  async findMyAds(userId: string) {
    return this.prisma.ad.findMany({
      where: {
        userId: userId
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        category: true
      }
    })
  }

  async findOne(id: string) {
    return this.prisma.ad.findFirst({
      where: {
        id,
        status: AdStatus.PUBLISHED
      },
      include: {
        category: true
      }
    })
  }

  private async deleteImagesFromS3(imageUrls: string[]) {
    const bucketName = this.configService.getOrThrow<string>('S3_BUCKET_NAME')
    const deletePromises = imageUrls.map(url => {
      const fileId = url.split(`${bucketName}/`)[1]
      return fileId ? this.fileService.deleteFile(fileId) : Promise.resolve()
    })
    await Promise.all(deletePromises)
  }

  async update(id: string, updateAdDto: UpdateAdDto, userId: string, files?: Express.Multer.File[]) {
    const ad = await this.prisma.ad.findFirst({
      where: { id, userId }
    })

    if (!ad) {
      throw new BadRequestException('Объявление не найдено')
    }

    let images = ad.images

    if (updateAdDto.images) {
      const remainingImages = updateAdDto.images

      const imagesToDelete = ad.images.filter(url => !remainingImages.includes(url))

      if (imagesToDelete.length > 0) {
        await this.deleteImagesFromS3(imagesToDelete)
      }

      images = remainingImages
    }

    if (files?.length) {
      const uploadResults = await Promise.all(files.map(file => this.fileService.uploadFile(file, 'ads')))

      images = [...images, ...uploadResults.map(r => r.url)]
    }

    return this.prisma.ad.update({
      where: { id },
      data: {
        ...updateAdDto,
        images,
        status: AdStatus.PENDING
      }
    })
  }

  async remove(id: string, userId: string) {
    const ad = await this.prisma.ad.findFirst({
      where: { id, userId }
    })

    if (ad?.images?.length) {
      await this.deleteImagesFromS3(ad.images)
    }

    return this.prisma.ad.deleteMany({
      where: { id, userId }
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

  async publish(id: string) {
    const ad = await this.prisma.ad.findUnique({
      where: { id }
    })

    if (!ad) {
      throw new BadRequestException('Объявление не найдено')
    }

    return this.prisma.ad.update({
      where: { id },
      data: {
        status: AdStatus.PUBLISHED,
        rejectionReason: null
      }
    })
  }

  async reject(id: string, reason?: string) {
    const ad = await this.prisma.ad.findUnique({
      where: { id }
    })

    if (!ad) {
      throw new BadRequestException('Объявление не найдено')
    }

    return this.prisma.ad.update({
      where: { id },
      data: {
        status: AdStatus.REJECTED,
        rejectionReason: reason
      }
    })
  }

  async findPending() {
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
      }
    })
  }
}
