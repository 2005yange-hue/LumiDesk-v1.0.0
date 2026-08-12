import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Logger } from '@nestjs/common'
import { ConversationService } from './conversation.service'
import type { CreateConversationDto } from './dto/create-conversation.dto'
import type { UpdateConversationDto } from './dto/update-conversation.dto'

@Controller('conversations')
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name)

  constructor(private readonly conversationService: ConversationService) {}

  /** GET /api/conversations — 会话列表 */
  @Get()
  async list() {
    return this.conversationService.listConversations()
  }

  /** GET /api/conversations/:id — 会话详情 */
  @Get(':id')
  async get(@Param('id') id: string) {
    return this.conversationService.getConversation(id)
  }

  /** GET /api/conversations/:id/messages — 历史消息分页 */
  @Get(':id/messages')
  async messages(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1)
    const l = Math.min(200, Math.max(1, parseInt(limit || '50', 10) || 50))
    return this.conversationService.getMessages(id, p, l)
  }

  /** POST /api/conversations — 创建新会话 */
  @Post()
  async create(@Body() dto: CreateConversationDto) {
    return this.conversationService.createConversation(dto)
  }

  /** PATCH /api/conversations/:id — 更新会话标题 */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateConversationDto) {
    return this.conversationService.updateConversation(id, dto)
  }

  /** DELETE /api/conversations/:id — 删除会话及其消息 */
  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.conversationService.deleteConversation(id)
    return { success: true }
  }
}
