import { Injectable, Logger } from '@nestjs/common'
import { LLMService, RuntimeModelConfig } from '../llm/llm.service'
import { LLMStreamChunk, LLMMessage } from '../llm/llm-adapter.interface'
import { SendMessageDto } from './dto/send-message.dto'
import { HistoryMessageDto } from './dto/message-response.dto'
import * as fs from 'fs'
import * as path from 'path'

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)
  private characterPrompt: string
  private systemPrompt: string

  constructor(private readonly llmService: LLMService) {
    this.characterPrompt = this.loadPrompt('character.txt')
    this.systemPrompt = this.loadPrompt('system.txt')
  }

  /**
   * 发送消息并获取流式响应
   */
  async sendMessageStream(
    dto: SendMessageDto,
    history: HistoryMessageDto[] = [],
    modelConfig?: Partial<RuntimeModelConfig>
  ): Promise<AsyncIterable<LLMStreamChunk>> {
    this.logger.log(`Received message: ${dto.content.substring(0, 50)}...`)

    // 构建完整消息上下文：系统 Prompt → 角色 Prompt → 历史记录 → 当前消息
    const messages = this.buildMessages(dto.content, history)

    return this.llmService.chatStream(messages, modelConfig)
  }

  /**
   * 构建发送给 LLM 的完整消息列表
   */
  private buildMessages(
    userMessage: string,
    history: HistoryMessageDto[]
  ): LLMMessage[] {
    const messages: LLMMessage[] = []

    // 系统指令
    if (this.systemPrompt) {
      messages.push({ role: 'system', content: this.systemPrompt })
    }

    // 角色人格
    if (this.characterPrompt) {
      messages.push({ role: 'system', content: this.characterPrompt })
    }

    // 历史对话（最近10轮）
    const recentHistory = history.slice(-20) // 最多保留20条历史
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content })
    }

    // 当前用户消息
    messages.push({ role: 'user', content: userMessage })

    return messages
  }

  /**
   * 加载 Prompt 模板文件
   */
  private loadPrompt(fileName: string): string {
    try {
      const filePath = path.join(__dirname, '..', '..', 'prompts', fileName)
      return fs.readFileSync(filePath, 'utf-8').trim()
    } catch (error) {
      this.logger.warn(`Failed to load prompt: ${fileName}`)
      return ''
    }
  }
}
