import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common'
import { AdsService } from './ads.service'
import { CreateAdDto } from './dto/create-ad.dto'
import { AuthGuard } from '../auth/guards/auth.guard'
import { Request } from 'express'
import { UseInterceptors, UploadedFiles } from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import 'multer'
import { AD_LIMITS } from './constants/ads.constants'
import { ModerateAdDto } from './dto/moderation-ad.dto'
import { Roles } from '../auth/decorators/roles.decorator'
import { RolesGuard } from '../auth/guards/roles.guard'
import { UserRole } from 'prisma/generated/enums'
import { UpdateAdDto } from './dto/update-ad.dto'

@Controller('ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Post()
  @UseGuards(AuthGuard)
  @UseInterceptors(FilesInterceptor('images', AD_LIMITS.PREMIUM))
  create(@Body() createAdDto: CreateAdDto, @Req() req: Request, @UploadedFiles() files: Express.Multer.File[]) {
    const userId = req.user.id

    return this.adsService.create(createAdDto, userId, files)
  }

  @Get()
  findAll(@Query('categoryId') categoryId?: string) {
    return this.adsService.findAll(categoryId)
  }

  @Get('my')
  @UseGuards(AuthGuard)
  findMyAds(@Req() req: Request) {
    const userId = req.user.id
    return this.adsService.findMyAds(userId)
  }

  @Get('pending')
  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  findPending() {
    return this.adsService.findPending()
  }

  @Patch(':id/publish')
  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  publish(@Param('id') id: string) {
    return this.adsService.publish(id)
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  reject(@Param('id') id: string, @Body() dto: ModerateAdDto) {
    return this.adsService.reject(id, dto.reason)
  }

  @Get('geocode')
  async getAddress(@Query('lat') lat: number, @Query('lon') lon: number) {
    return await this.adsService.getAddressFromCoords(lat, lon)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adsService.findOne(id)
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @UseInterceptors(FilesInterceptor('images', AD_LIMITS.PREMIUM))
  update(
    @Param('id') id: string,
    @Body() updateAdDto: UpdateAdDto,
    @Req() req: Request,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    return this.adsService.update(id, updateAdDto, req.user.id, files)
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  remove(@Param('id') id: string, @Req() req: Request) {
    const userId = req.user.id
    return this.adsService.remove(id, userId)
  }
}
