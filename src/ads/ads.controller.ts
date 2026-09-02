import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
  UnauthorizedException,
  ParseUUIDPipe,
  ParseIntPipe,
  ParseBoolPipe,
  DefaultValuePipe
} from '@nestjs/common'
import { AdsService } from './ads.service'
import { CreateAdDto } from './dto/create-ad.dto'
import { AuthGuard } from '../auth/guards/auth.guard'
import { Request } from 'express'
import { UseInterceptors, UploadedFiles } from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import 'multer'
import { AD_LIMITS, AD_MAX_FILE_SIZE } from './constants/ads.constants'
import { ModerateAdDto } from './dto/moderation-ad.dto'
import { Roles } from '../auth/decorators/roles.decorator'
import { RolesGuard } from '../auth/guards/roles.guard'
import { UserRole } from '@/generated/prisma/enums'
import { UpdateAdDto } from './dto/update-ad.dto'
import { CurrentUser } from '@/auth/decorators/decorators/user.decorator'
import { computeViewerKey } from './utils/viewer-key.util'
import { FindAdsQueryDto } from './dto/find-ads-query.dto'
import { FindMyAdsQueryDto } from './dto/find-my-ads-query.dto'
import { User } from '@/generated/prisma/client'

@Controller('ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Post(':id/favorite')
  @UseGuards(AuthGuard)
  async addFavorite(@Param('id', ParseUUIDPipe) adId: string, @CurrentUser('id') userId: string) {
    return this.adsService.addFavorite(userId, adId)
  }

  @Delete(':id/favorite')
  @UseGuards(AuthGuard)
  async removeFavorite(@Param('id', ParseUUIDPipe) adId: string, @CurrentUser('id') userId: string) {
    return this.adsService.removeFavorite(userId, adId)
  }

  @Get('me/favorites')
  @UseGuards(AuthGuard)
  async getFavorites(
    @CurrentUser('id') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number
  ) {
    return this.adsService.getFavorites(userId, page, limit)
  }

  @Post()
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', AD_LIMITS.PREMIUM, {
      limits: { fileSize: AD_MAX_FILE_SIZE }
    })
  )
  async create(
    @Body() createAdDto: CreateAdDto,
    @CurrentUser('id') userId: string,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    return this.adsService.create(createAdDto, userId, files) // <-- И передаваться первым аргументом в сервис
  }

  @Get()
  async findAll(@Query() query: FindAdsQueryDto, @Req() request: Request) {
    const userId = request.session?.userId

    return this.adsService.findAll(query, userId)
  }

  @Get('my')
  @UseGuards(AuthGuard)
  findMyAds(@CurrentUser() user: User, @Query() query: FindMyAdsQueryDto) {
    if (!user?.id) {
      throw new UnauthorizedException()
    }

    return this.adsService.findMyAds(user.id, query)
  }

  @Get('pending')
  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  findPending(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number
  ) {
    return this.adsService.findPending(page, limit)
  }

  @Patch(':id/publish')
  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.adsService.publish(id)
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() { reason }: ModerateAdDto) {
    return this.adsService.reject(id, reason)
  }

  // Предпросмотр для модератора — та же самая карточка объявления, что и
  // на публичной странице, но без ограничения по статусу (см.
  // AdsService.findOneForModeration). Именно ':id/moderation', а не сам
  // ':id' — публичный @Get(':id') ниже намеренно жёстко привязан к
  // PUBLISHED и не должен превратиться в дырку для просмотра чужих
  // черновиков/объявлений на модерации по прямой ссылке.
  @Get(':id/moderation')
  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  findOneForModeration(@Param('id', ParseUUIDPipe) id: string) {
    return this.adsService.findOneForModeration(id)
  }

  @Get('geocode')
  async getAddress(@Query('lat') lat: number, @Query('lon') lon: number) {
    return await this.adsService.getAddressFromCoords(lat, lon)
  }

  // Регистрируем до @Get(':id') — иначе Nest примет 'locations' за id.
  @Get('locations')
  getAvailableLocations() {
    return this.adsService.getAvailableLocations()
  }

  @Get('my/:id')
  @UseGuards(AuthGuard)
  findOneForOwner(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.adsService.findOneForOwner(id, userId)
  }

  // Статистика просмотров — приватная, отдаём только владельцу объявления
  // (см. AdsService.getViewStatsForOwner). Публичного эндпоинта для этого
  // нет и не планируется (см. обсуждение). weekOffset — 0 текущая неделя,
  // 1 прошлая и так далее, сервис сам зажимает в допустимый диапазон.
  @Get('my/:id/views')
  @UseGuards(AuthGuard)
  getMyAdViewStats(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Query('weekOffset', new DefaultValuePipe(0), ParseIntPipe) weekOffset: number
  ) {
    return this.adsService.getViewStatsForOwner(id, userId, weekOffset)
  }

  // Компактные счётчики владельца (просмотры всего/сегодня, избранное) —
  // для панели над фото на странице объявления (см. AdsService.getCountersForOwner).
  // Отдельно от .../views — та отдаёт тяжёлый недельный график, тут лёгкий
  // объект без разбивки по дням.
  @Get('my/:id/counters')
  @UseGuards(AuthGuard)
  getMyAdCounters(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.adsService.getCountersForOwner(id, userId)
  }

  // Та же статистика, но для админа — на любое объявление, не только своё
  // (см. AdsService.getViewStatsForAdmin). ':id/views', а не 'my/:id/views' —
  // тот же приём, что и с ':id/moderation' ниже: отдельный явный путь, а не
  // расширение владельческого эндпоинта.
  @Get(':id/views')
  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  getAdViewStatsForAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('weekOffset', new DefaultValuePipe(0), ParseIntPipe) weekOffset: number
  ) {
    return this.adsService.getViewStatsForAdmin(id, weekOffset)
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() request: Request,
    // trackView — явный флаг "это настоящий визит браузера, а не серверный
    // SSR-запрос страницы" (см. AdsService.findOne/recordView). SSR-вызов
    // в client/src/app/(main)/ads/[id]/page.tsx делает обычный
    // adsService.findOne(id) без этого флага — у него нет ни сессионной
    // куки, ни реального IP/UA посетителя (Next.js сервер их не
    // прокидывает), поэтому запись просмотра оттуда была бы либо мимо
    // владельца (userId всегда undefined → исключение владельца не
    // срабатывает), либо схлопывала бы всех разных посетителей в один
    // viewerKey (один и тот же IP/UA у самого Next.js сервера). Настоящий
    // клиентский рефетч в useAd (см. use-ad.ts) передаёт trackView=true —
    // у него уже есть куки и реальные IP/UA браузера.
    @Query('trackView', new DefaultValuePipe(false), ParseBoolPipe) trackView: boolean
  ) {
    // Эндпоинт публичный (без @UseGuards) — доступен и без авторизации, но
    // если сессия есть, передаём userId в сервис, чтобы корректно посчитать
    // isFavorite именно для текущего пользователя (см. AdsService.findOne).
    // viewerKey — для дедупа статистики просмотров, см.
    // ads/utils/viewer-key.util.ts и AdsService.findOne/recordView.
    const userId = request.session?.userId
    const viewerKey = computeViewerKey(userId, request)

    return this.adsService.findOne(id, userId, viewerKey, trackView)
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FilesInterceptor('images', AD_LIMITS.PREMIUM, {
      limits: {
        fileSize: AD_MAX_FILE_SIZE
      }
    })
  )
  update(
    @Param('id') id: string,
    @Body() updateAdDto: UpdateAdDto,
    @CurrentUser('id') userId: string,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    return this.adsService.update(id, updateAdDto, userId, files)
  }

  @Patch(':id/archive')
  @UseGuards(AuthGuard)
  archive(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.adsService.archive(id, userId)
  }

  @Patch(':id/activate')
  @UseGuards(AuthGuard)
  activate(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.adsService.activate(id, userId)
  }

  @Patch(':id/republish')
  @UseGuards(AuthGuard)
  async republish(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() updateDto: UpdateAdDto) {
    const data = Object.keys(updateDto).length > 0 ? updateDto : undefined
    return this.adsService.republish(id, userId, data)
  }

  @Post('draft')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', AD_LIMITS.PREMIUM, {
      limits: { fileSize: AD_MAX_FILE_SIZE }
    })
  )
  async saveDraft(
    @Body() createAdDto: CreateAdDto & { existingImages?: string[] | string },
    @CurrentUser('id') userId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Query('id') id?: string
  ) {
    const existingImages =
      typeof createAdDto.existingImages === 'string' ? [createAdDto.existingImages] : createAdDto.existingImages

    return this.adsService.saveDraft(userId, { ...createAdDto, existingImages }, files, id)
  }

  @Patch(':id/draft')
  @UseGuards(AuthGuard)
  draft(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.adsService.draft(id, userId)
  }

  @Patch(':id/publish-draft')
  @UseGuards(AuthGuard)
  publishDraft(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.adsService.publishDraft(id, userId)
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.adsService.remove(id, userId)
  }
}
