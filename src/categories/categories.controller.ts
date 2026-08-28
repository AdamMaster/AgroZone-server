import { Controller, Get, Query } from '@nestjs/common'
import { CategoriesService } from './categories.service'
import { SearchCategoriesDto } from './dto/search-categories.dto'

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll() {
    return this.categoriesService.findAll()
  }

  @Get('search-suggest')
  searchSuggest(@Query() query: SearchCategoriesDto) {
    return this.categoriesService.searchBySemantic(query.q ?? '')
  }
}
