import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common'

import { CurrentUser } from '@/auth/decorators/decorators/user.decorator'
import { AuthGuard } from '@/auth/guards/auth.guard'

import { ConversationsService } from './conversations.service'
import { FindMessagesQueryDto } from './dto/find-messages-query.dto'
import { SendMessageDto } from './dto/send-message.dto'
import { StartConversationDto } from './dto/start-conversation.dto'

// Весь модуль — только для авторизованных: в отличие от просмотра
// объявлений, написать продавцу анонимно нельзя (иначе не с кем будет
// связать диалог и некому будет отвечать).
@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  start(@CurrentUser('id') userId: string, @Body() dto: StartConversationDto) {
    return this.conversationsService.startConversation(userId, dto)
  }

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.conversationsService.getConversations(userId)
  }

  @Get(':id/messages')
  findMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Query() query: FindMessagesQueryDto
  ) {
    return this.conversationsService.getMessages(id, userId, query)
  }

  @Post(':id/messages')
  sendMessage(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string, @Body() dto: SendMessageDto) {
    return this.conversationsService.sendMessage(id, userId, dto)
  }

  @Patch(':id/read')
  markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.conversationsService.markRead(id, userId)
  }

  // Обычно скрывает диалог только у вызывающего (не физическое удаление) —
  // но если собеседник уже удалил свой аккаунт, удаляет диалог физически и
  // навсегда (см. комментарий к ConversationsService.deleteConversation).
  @Delete(':id')
  delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.conversationsService.deleteConversation(id, userId)
  }
}
