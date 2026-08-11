import { Injectable, Logger } from '@nestjs/common'
import { LLMService, RuntimeModelConfig } from '../llm/llm.service'
import { LLMStreamChunk } from '../llm/llm-adapter.interface'
import { PromptContextService } from './prompt-context.service'
import { SendMessageDto } from './dto/send-message.dto'
import { HistoryMessageDto } from './dto/message-response.dto'

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)

  constructor(
    private readonly llmService: LLMService,
    private readonly promptContext: PromptContextService
  ) {}

  /**
   * 发送消息并获取流式响应
   * @param characterId 可选，指定使用的角色ID，不传则使用默认角色
   */
  async sendMessageStream(
    dto: SendMessageDto,
    history: HistoryMessageDto[] = [],
    modelConfig?: Partial<RuntimeModelConfig>,
    characterId?: string
  ): Promise<AsyncIterable<LLMStreamChunk>> {
    this.logger.log(`Received message: ${dto.content.substring(0, 50)}...`)

    const messages = this.promptContext.buildMessages(dto.content, history, characterId)

    return this.llmService.chatStream(messages, modelConfig)
  }
}
