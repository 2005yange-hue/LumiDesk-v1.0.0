import { Controller, Post, Body, Res, HttpCode, Logger } from '@nestjs/common'
import { Response } from 'express'
import { ChatService } from './chat.service'
import { MemoryService } from '../memory/memory.service'
import { MemoryExtractorService } from '../memory/memory-extractor.service'
import { RuntimeModelConfig } from '../llm/llm-types'
import { HistoryMessageDto } from './dto/message-response.dto'
import { formatLLMError } from '../../common/error-formatter'

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name)

  constructor(
    private readonly chatService: ChatService,
    private readonly memoryService: MemoryService,
    private readonly memoryExtractor: MemoryExtractorService
  ) {}

  /**
   * 发送消息 - SSE 流式响应
   * 支持传入历史记录 + 运行时模型配置 + 角色选择
   * 异步提取长期记忆（不阻塞SSE）
   */
  @Post('send')
  @HttpCode(200)
  async sendMessage(
    @Body() body: {
      content: string
      history?: HistoryMessageDto[]
      modelConfig?: Partial<RuntimeModelConfig>
      characterId?: string
    },
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
        body.characterId
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

      // 异步持久化（不阻塞 SSE 响应，失败自动记录日志）
      this.memoryService.saveMessages(body.content, fullContent, body.characterId)

      // 异步提取长期记忆（fire-and-forget，不阻塞响应）
      this.extractAndSaveMemory(body.content)
    } catch (error) {
      this.logger.error('Chat error:', error)
      // 错误也不终止 SSE，确保前端能收到错误信息
      const errorMsg = formatLLMError(error)
      res.write(`data: ${JSON.stringify({ error: errorMsg, done: true })}\n\n`)
      res.end()
    }
  }

  /**
   * 从用户消息中提取并保存长期记忆
   * 完全异步，不影响聊天响应
   */
  private extractAndSaveMemory(userMessage: string): void {
    this.memoryExtractor
      .extractMemories(userMessage)
      .then((entries) => {
        if (entries.length > 0) {
          return this.memoryService.saveMemoryEntries(entries)
        }
      })
      .catch((err) => {
        this.logger.warn('Memory extraction pipeline failed (non-blocking):', err)
      })
  }
}
