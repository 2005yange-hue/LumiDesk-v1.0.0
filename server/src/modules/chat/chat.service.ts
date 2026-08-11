import { Injectable, Logger } from '@nestjs/common'
import { LLMService, RuntimeModelConfig } from '../llm/llm.service'
import { LLMStreamChunk, LLMMessage } from '../llm/llm-adapter.interface'
import { CharacterService } from '../character/character.service'
import { PersonaBuilder } from '../character/persona-builder'
import { SendMessageDto } from './dto/send-message.dto'
import { HistoryMessageDto } from './dto/message-response.dto'
import * as fs from 'fs'
import * as path from 'path'

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)
  private systemPrompt: string
  private fallbackCharacterPrompt: string

  constructor(
    private readonly llmService: LLMService,
    private readonly characterService: CharacterService
  ) {
    this.systemPrompt = this.loadPrompt('system.txt')
    this.fallbackCharacterPrompt = this.loadPrompt('character.txt')
  }

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

    const messages = this.buildMessages(dto.content, history, characterId)

    return this.llmService.chatStream(messages, modelConfig)
  }

  /**
   * 构建发送给 LLM 的完整消息列表
   */
  private buildMessages(
    userMessage: string,
    history: HistoryMessageDto[],
    characterId?: string
  ): LLMMessage[] {
    const messages: LLMMessage[] = []

    // 系统指令
    if (this.systemPrompt) {
      messages.push({ role: 'system', content: this.systemPrompt })
    }

    // 角色人格 — 动态生成或回退
    const characterPrompt = this.buildCharacterPrompt(characterId)
    if (characterPrompt) {
      messages.push({ role: 'system', content: characterPrompt })
    }

    // 历史对话
    const recentHistory = history.slice(-20)
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content })
    }

    // 当前用户消息
    messages.push({ role: 'user', content: userMessage })

    return messages
  }

  /**
   * 构建角色人格 Prompt
   * 优先使用 CharacterService 中的角色数据，回退到文件模板
   */
  private buildCharacterPrompt(characterId?: string): string {
    // 1. 尝试从 CharacterService 获取指定角色
    if (characterId) {
      const character = this.characterService.findOne(characterId)
      if (character) {
        this.logger.log(`Using character: ${character.name}`)
        return PersonaBuilder.build(character)
      }
    }

    // 2. 获取默认角色
    const defaultChar = this.characterService.getDefault()
    if (defaultChar) {
      this.logger.log(`Using default character: ${defaultChar.name}`)
      return PersonaBuilder.build(defaultChar)
    }

    // 3. 回退到文件模板
    if (this.fallbackCharacterPrompt) {
      return this.fallbackCharacterPrompt
    }

    return ''
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
