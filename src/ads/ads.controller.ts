import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common'
import { AdsService } from './ads.service'
import { CreateAdDto } from './dto/create-ad.dto'
import { AuthGuard } from '../auth/guards/auth.guard'
import { Request } from 'express'

@Controller('ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Post()
  @UseGuards(AuthGuard) // Защищаем роут
  create(@Body() createAdDto: any, @Req() req: Request) {
    // Достаем userId из сессии, который туда положил AuthGuard, и передаем в сервис
    const userId = (req.user as any).id
    return this.adsService.create(createAdDto, userId)
  }

  @Get()
  findAll(@Query('categoryId') categoryId?: string) {
    return this.adsService.findAll(categoryId)
  }

  @Get('my')
  @UseGuards(AuthGuard)
  findMyAds(@Req() req: Request) {
    const userId = (req.user as any).id
    return this.adsService.findMyAds(userId)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adsService.findOne(id)
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  update(@Param('id') id: string, @Body() updateAdDto: any, @Req() req: Request) {
    const userId = (req.user as any).id
    return this.adsService.update(id, updateAdDto, userId)
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  remove(@Param('id') id: string, @Req() req: Request) {
    const userId = (req.user as any).id
    return this.adsService.remove(id, userId)
  }
}
