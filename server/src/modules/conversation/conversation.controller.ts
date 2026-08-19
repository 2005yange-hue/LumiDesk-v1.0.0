import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ConversationService } from './conversation.service'
import { CreateConversationDto } from './dto/create-conversation.dto'
import { UpdateConversationDto } from './dto/update-conversation.dto'
import { UpdateMessageDto } from './dto/update-message.dto'

@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get() list() { return this.conversationService.listConversations() }
  @Get(':id/export') export(@Param('id') id: string, @Query('format') format?: string) { return this.conversationService.exportConversation(id, format === 'json' ? 'json' : 'markdown') }
  @Get(':id/messages') messages(@Param('id') id: string, @Query('page') page?: string, @Query('limit') limit?: string) { return this.conversationService.getMessages(id, Math.max(1, parseInt(page || '1', 10) || 1), Math.min(200, Math.max(1, parseInt(limit || '50', 10) || 50))) }
  @Patch(':id/messages/:messageId') editMessage(@Param('id') id: string, @Param('messageId') messageId: string, @Body() dto: UpdateMessageDto) { return this.conversationService.prepareEdit(id, messageId, dto.content) }
  @Post(':id/messages/:messageId/regenerate') regenerate(@Param('id') id: string, @Param('messageId') messageId: string) { return this.conversationService.prepareRegenerate(id, messageId) }
  @Delete(':id/messages/:messageId') deleteMessage(@Param('id') id: string, @Param('messageId') messageId: string) { return this.conversationService.deleteFromMessage(id, messageId) }
  @Get(':id') get(@Param('id') id: string) { return this.conversationService.getConversation(id) }
  @Post() create(@Body() dto: CreateConversationDto) { return this.conversationService.createConversation(dto) }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateConversationDto) { return this.conversationService.updateConversation(id, dto) }
  @Delete(':id') async delete(@Param('id') id: string) { await this.conversationService.deleteConversation(id); return { success: true } }
}
