import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common'

import { CurrentUser } from '@/auth/decorators/decorators/user.decorator'
import { AuthGuard } from '@/auth/guards/auth.guard'

import { BlockedUsersService } from './blocked-users.service'

@Controller('blocked-users')
@UseGuards(AuthGuard)
export class BlockedUsersController {
  constructor(private readonly blockedUsersService: BlockedUsersService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.blockedUsersService.getBlockedUsers(userId)
  }

  @Post(':id')
  block(@Param('id', ParseUUIDPipe) blockedId: string, @CurrentUser('id') userId: string) {
    return this.blockedUsersService.blockUser(userId, blockedId)
  }

  @Delete(':id')
  unblock(@Param('id', ParseUUIDPipe) blockedId: string, @CurrentUser('id') userId: string) {
    return this.blockedUsersService.unblockUser(userId, blockedId)
  }
}
