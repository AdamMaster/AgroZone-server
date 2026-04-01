import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch } from '@nestjs/common'
import { UserService } from './user.service'
import { Authorized } from '@/auth/decorators/authorized.decorator'
import { Authorization } from '@/auth/decorators/auth.decorator'
import { UserRole } from 'prisma/generated/enums'
import { UpdateUserDto } from './dto/update-user.dto'

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Get('profile')
  async findProfile(@Authorized('id') userId: string) {
    return this.userService.findById(userId)
  }

  @Authorization(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Get('by-id/:id')
  async findById(@Param('id') id: string) {
    return this.userService.findById(id)
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Patch('profile')
  async updateProfile(@Authorized('id') userId: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(userId, dto)
  }
}
