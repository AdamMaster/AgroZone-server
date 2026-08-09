import { Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common'

import { CurrentUser } from '@/auth/decorators/decorators/user.decorator'
import { AuthGuard } from '@/auth/guards/auth.guard'

import { FindNotificationsQueryDto } from './dto/find-notifications-query.dto'
import { NotificationsService } from './notifications.service'

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findMy(@CurrentUser('id') userId: string, @Query() query: FindNotificationsQueryDto) {
    return this.notificationsService.findMyNotifications(userId, query)
  }

  @Get('unread-count')
  countUnread(@CurrentUser('id') userId: string) {
    return this.notificationsService.countUnread(userId)
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId)
  }

  @Patch(':id/read')
  markAsRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.notificationsService.markAsRead(userId, id)
  }
}
