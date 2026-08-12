import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CharacterService } from '../character/character.service'
import { PersonaBuilder } from '../character/persona-builder'
import { MemoryService } from '../memory/memory.service'
import { VectorMemoryService } from '../vector-memory/vector-memory.service'
import { LLMMessage } from '../llm/llm-adapter.interface'
import { HistoryMessageDto } from './dto/message-response.dto'
import * as fs from 'fs'
import * as path from 'path'

/**
 * 上下文聚合层
 * 负责将系统指令 / 长期记忆 / 角色人格 / 历史记录 / 用户消息组装为 LLM 消息数组
 *
 * 未来扩展：
 *  - VisionService    → 注入屏幕分析结果
 *  - EmotionService   → 注入当前情绪状态
 */
@Injectable()
export class PromptContextService {
  private readonly logger = new Logger(PromptContextService.name)
  private systemPromptCache: string | null = null
  private fallbackCharacterPrompt: string

  constructor(
    private readonly characterService: CharacterService,
    private readonly memoryService: MemoryService,
    private readonly vectorMemory: VectorMemoryService,
    private readonly configService: ConfigService
  ) {
    this.fallbackCharacterPrompt = this.loadPrompt('character.txt')
  }

  /** 对话历史上下文条数上限 */
  private get contextLimit(): number {
    return this.configService.get<number>('CHAT_CONTEXT_LIMIT', 20)
  }

  /**
   * 构建发送给 LLM 的完整消息列表
   * 包含系统指令 → 长期记忆 → 角色人格 → 历史 → 用户消息
   */
  async buildMessages(
    userMessage: string,
    history: HistoryMessageDto[],
    characterId?: string
  ): Promise<LLMMessage[]> {
    const messages: LLMMessage[] = []

    // 1. 系统指令
    const system = this.getSystemPrompt()
    if (system) {
      messages.push({ role: 'system', content: system })
    }

    // 2. 角色人格（优先于记忆，避免 memory 修改角色设定）
    const persona = this.buildCharacterPrompt(characterId)
    if (persona) {
      messages.push({ role: 'system', content: persona })
    }

    // 3. 长期记忆（语义检索 + MySQL 回退）
    const memories = await this.loadMemories(userMessage)
    if (memories) {
      messages.push({ role: 'system', content: memories })
    }

    // 4. 历史对话（最近 N 条）
    const recentHistory = history.slice(-this.contextLimit)
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content })
    }

    // 5. 当前用户消息
    messages.push({ role: 'user', content: userMessage })

    this.logger.log('[Context] messages order: system -> character -> memory -> history -> user')

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

  // ──── 长期记忆 ────

  /**
   * 加载用户长期记忆，格式化为 system message
   * 优先使用向量语义搜索，失败时回退到 MySQL 查询
   * @param userMessage 当前用户输入，用于语义匹配
   */
  private async loadMemories(userMessage: string): Promise<string | null> {
    try {
      // 1. 优先向量语义搜索
      const vectorResults = await this.vectorMemory.search(userMessage)
      if (vectorResults.length > 0) {
        const items = vectorResults.map((r) => `  <memory type="${r.type}" score="${r.score.toFixed(2)}">${r.content}</memory>`)
        return `<relevant_memories>\n${items.join('\n')}\n</relevant_memories>`
      }

      // 2. 回退：MySQL 高重要性记忆
      const entries = await this.memoryService.getMemoriesByUser()
      if (entries.length === 0) return null

      const items = entries.map((e) => `  <memory type="${e.type}">${e.content}</memory>`)
      return `<relevant_memories>\n${items.join('\n')}\n</relevant_memories>`
    } catch (error) {
      this.logger.warn('Failed to load memories:', error)

      // 最终回退：静默失败，不影响聊天
      try {
        const entries = await this.memoryService.getMemoriesByUser()
        if (entries.length === 0) return null
        const items = entries.map((e) => `  <memory type="${e.type}">${e.content}</memory>`)
        return `<relevant_memories>\n${items.join('\n')}\n</relevant_memories>`
      } catch {
        return null
      }
    }
  }

  private loadPrompt(fileName: string): string {
    try {
      const filePath = path.join(__dirname, '..', '..', 'prompts', fileName)
      const content = fs.readFileSync(filePath, 'utf-8').trim()
      this.logger.log(`Loaded prompt: ${fileName} (${content.length} chars)`)
      return content
    } catch (error) {
      this.logger.warn(`Failed to load prompt: ${fileName}, error: ${(error as Error).message}`)
      return ''
    }
  }
}
