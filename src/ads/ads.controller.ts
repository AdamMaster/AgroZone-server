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
  UnauthorizedException
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
import { UserRole } from 'prisma/generated/enums'
import { UpdateAdDto } from './dto/update-ad.dto'
import { CurrentUser } from '@/auth/decorators/decorators/user.decorator'
import { FindAdsQueryDto } from './dto/find-ads-query.dto'
import { FindMyAdsQueryDto } from './dto/find-my-ads-query.dto'
import { User } from 'prisma/generated/client'

@Controller('ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Post()
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FilesInterceptor('images', AD_LIMITS.PREMIUM, {
      limits: {
        fileSize: AD_MAX_FILE_SIZE
      }
    })
  )
  create(
    @Body() createAdDto: CreateAdDto,
    @CurrentUser('id') userId: string,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    return this.adsService.create(createAdDto, userId, files)
  }

  @Get()
  findAll(@Query() query: FindAdsQueryDto) {
    return this.adsService.findAll(query)
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
  findPending(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adsService.findPending(page, limit)
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
  reject(@Param('id') id: string, @Body() { reason }: ModerateAdDto) {
    return this.adsService.reject(id, reason)
  }

  @Get('geocode')
  async getAddress(@Query('lat') lat: number, @Query('lon') lon: number) {
    return await this.adsService.getAddressFromCoords(lat, lon)
  }

  @Get('my/:id')
  @UseGuards(AuthGuard)
  findOneForOwner(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.adsService.findOneForOwner(id, userId)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adsService.findOne(id)
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
