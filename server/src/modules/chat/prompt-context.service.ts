import { Injectable, Logger } from '@nestjs/common'
import { CharacterService } from '../character/character.service'
import { PersonaBuilder } from '../character/persona-builder'
import { LLMMessage } from '../llm/llm-adapter.interface'
import { HistoryMessageDto } from './dto/message-response.dto'
import * as fs from 'fs'
import * as path from 'path'

/**
 * 上下文聚合层
 * 负责将系统指令 / 角色人格 / 历史记录 / 用户消息组装为 LLM 消息数组
 *
 * 未来扩展：
 *  - MemoryService    → 注入长期记忆片段
 *  - VisionService    → 注入屏幕分析结果
 *  - EmotionService   → 注入当前情绪状态
 */
@Injectable()
export class PromptContextService {
  private readonly logger = new Logger(PromptContextService.name)
  private systemPromptCache: string | null = null
  private fallbackCharacterPrompt: string

  constructor(private readonly characterService: CharacterService) {
    this.fallbackCharacterPrompt = this.loadPrompt('character.txt')
  }

  /**
   * 构建发送给 LLM 的完整消息列表
   */
  buildMessages(
    userMessage: string,
    history: HistoryMessageDto[],
    characterId?: string
  ): LLMMessage[] {
    const messages: LLMMessage[] = []

    // 1. 系统指令
    const system = this.getSystemPrompt()
    if (system) {
      messages.push({ role: 'system', content: system })
    }

    // 2. 角色人格
    const persona = this.buildCharacterPrompt(characterId)
    if (persona) {
      messages.push({ role: 'system', content: persona })
    }

    // 3. 历史对话（最近 20 条）
    const recentHistory = history.slice(-20)
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content })
    }

    // 4. 当前用户消息
    messages.push({ role: 'user', content: userMessage })

    return messages
  }

  // ──── 系统指令 ────

  private getSystemPrompt(): string {
    if (!this.systemPromptCache) {
      this.systemPromptCache = this.loadPrompt('system.txt')
    }
    return this.systemPromptCache
  }

  // ──── 角色人格 ────

  /**
   * 构建角色人格 Prompt
   * 优先使用 CharacterService 中的角色数据，回退到静态模板
   */
  private buildCharacterPrompt(characterId?: string): string {
    // 1. 指定角色
    if (characterId) {
      const character = this.characterService.findOne(characterId)
      if (character) {
        this.logger.log(`Using character: ${character.name}`)
        return PersonaBuilder.build(character)
      }
    }

    // 2. 默认角色
    const defaultChar = this.characterService.getDefault()
    if (defaultChar) {
      this.logger.log(`Using default character: ${defaultChar.name}`)
      return PersonaBuilder.build(defaultChar)
    }

    // 3. 文件模板回退
    return this.fallbackCharacterPrompt
  }

  // ──── 文件加载 ────

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
