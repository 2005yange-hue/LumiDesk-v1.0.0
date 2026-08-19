import { Controller, Post, Body, Res, HttpCode, Logger } from '@nestjs/common'
import { Response } from 'express'
import { ChatService } from './chat.service'
import { ConversationService } from '../conversation/conversation.service'
import { SendMessageDto } from './dto/send-message.dto'
import { formatLLMError } from '../../common/error-formatter'

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name)

  constructor(
    private readonly chatService: ChatService,
    private readonly conversationService: ConversationService
  ) {}

  /**
   * 发送消息 - SSE 流式响应
   * 支持传入历史记录 + 运行时模型配置 + 角色选择
   * 长期记忆提取由 ChatService.sendMessageStream 内部 fire-and-forget 处理
   */
  @Post('send')
  @HttpCode(200)
  async sendMessage(
    @Body() body: SendMessageDto,
    @Res() res: Response
  ) {
    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    try {
      const stream = await this.chatService.sendMessageStream(
        { content: body.content },
        body.history || [],
        body.modelConfig,
        body.characterId,
        body.conversationId
      )

      let fullContent = ''
      for await (const chunk of stream) {
        fullContent += chunk.content
        // SSE 格式: data: {...}\n\n
        res.write(`data: ${JSON.stringify({ content: chunk.content, fullContent, done: chunk.done })}\n\n`)
      }

      // 发送结束事件
      res.write(`data: ${JSON.stringify({ content: '', fullContent, done: true, id: Date.now().toString() })}\n\n`)
      res.end()

      // 持久化完成后再建立来源追踪，避免自动记忆关联到不存在的消息。
      void this.conversationService.saveCurrentMessages(body.content, fullContent, body.conversationId, body.characterId)
        .then(async (saved) => {
          if (!saved) return
          await Promise.all([
            this.chatService.recordCompletedInteraction(
              body.characterId,
              body.content,
              fullContent,
              body.conversationId,
              saved.userMessageId,
              saved.assistantMessageId
            ),
            this.chatService.extractMemoriesForCompletedInteraction(
              body.content,
              body.modelConfig,
              body.characterId,
              body.conversationId,
              saved.userMessageId,
              saved.assistantMessageId
            ),
            this.chatService.analyzeEmotionForCompletedInteraction(
              body.content,
              body.modelConfig,
              body.characterId,
              body.conversationId,
              saved.userMessageId
            )
          ])
        })
        .catch((error) => this.logger.warn('Failed to persist completed interaction (non-blocking):', error))
    } catch (error) {
      this.logger.error('Chat error:', error)
      // 错误也不终止 SSE，确保前端能收到错误信息
      const errorMsg = formatLLMError(error)
      res.write(`data: ${JSON.stringify({ error: errorMsg, done: true })}\n\n`)
      res.end()
    }
  }
}
