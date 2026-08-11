import { Injectable, Logger } from '@nestjs/common'
import { LLMService } from '../llm/llm.service'
import { RuntimeModelConfig } from '../llm/llm-types'
import { LLMStreamChunk } from '../llm/llm-adapter.interface'
import { PromptContextService } from './prompt-context.service'
import { ContextWindowManager } from '../context-window/context-window.manager'
import { SendMessageDto } from './dto/send-message.dto'
import { HistoryMessageDto } from './dto/message-response.dto'

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)

  constructor(
    private readonly llmService: LLMService,
    private readonly promptContext: PromptContextService,
    private readonly contextWindow: ContextWindowManager
  ) {}

  /**
   * 发送消息并获取流式响应
   * 自动检测并裁剪超出上下文窗口的消息
   * @param characterId 可选，指定使用的角色ID，不传则使用默认角色
   */
  async sendMessageStream(
    dto: SendMessageDto,
    history: HistoryMessageDto[] = [],
    modelConfig?: Partial<RuntimeModelConfig>,
    characterId?: string
  ): Promise<AsyncIterable<LLMStreamChunk>> {
    this.logger.log(`Received message: ${dto.content.substring(0, 50)}...`)

    let messages = await this.promptContext.buildMessages(dto.content, history, characterId)

    // 上下文窗口检测与裁剪
    const modelName = modelConfig?.model
    if (this.contextWindow.checkOverflow(messages, modelName)) {
      messages = this.contextWindow.trimMessages(messages, modelName)
    }

    return this.llmService.chatStream(messages, modelConfig)
  }
}
