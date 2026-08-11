import { Controller, Post, Body, Res, HttpCode, Logger } from '@nestjs/common'
import { Response } from 'express'
import { ChatService } from './chat.service'
import { RuntimeModelConfig } from '../llm/llm.service'
import { HistoryMessageDto } from './dto/message-response.dto'

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name)

  constructor(private readonly chatService: ChatService) {}

  /**
   * 发送消息 - SSE 流式响应
   * 支持传入历史记录 + 运行时模型配置
   */
  @Post('send')
  @HttpCode(200)
  async sendMessage(
    @Body() body: {
      content: string
      history?: HistoryMessageDto[]
      modelConfig?: Partial<RuntimeModelConfig>
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
        body.modelConfig
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
    } catch (error) {
      this.logger.error('Chat error:', error)
      // 错误也不终止 SSE，确保前端能收到错误信息
      const errorMsg = this.formatError(error)
      res.write(`data: ${JSON.stringify({ error: errorMsg, done: true })}\n\n`)
      res.end()
    }
  }

  /**
   * 格式化错误信息
   */
  private formatError(error: unknown): string {
    if (error instanceof Error) {
      const err = error as Error & { status?: number; code?: string }

      if (err.status === 401 || err.code === 'invalid_api_key') {
        return 'API Key 无效，请检查您的 LLM_API_KEY 配置'
      }
      if (err.status === 429 || err.code === 'insufficient_quota') {
        return 'API 配额不足，请检查您的账户余额'
      }
      if (err.code === 'ECONNREFUSED' || err.message?.includes('timeout')) {
        return '无法连接到模型服务，请检查网络或 BASE_URL 配置'
      }
      if (err.message?.includes('context_length_exceeded')) {
        return '对话内容过长，请简化您的问题或清空历史记录'
      }
      return err.message || '未知错误，请稍后重试'
    }
    return '服务异常，请稍后重试'
  }
}
