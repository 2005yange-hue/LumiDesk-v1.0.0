import { Injectable, Logger } from '@nestjs/common'
import { LLMService } from '../llm/llm.service'
import { RuntimeModelConfig, ResolvedModelConfig } from '../llm/llm-types'
import { MEMORY_TYPES, MemoryType } from './entities/memory-entry.entity'
import * as fs from 'fs'
import * as path from 'path'

export interface MemoryEntryData {
  type: MemoryType
  content: string
  importance: number
  confidence: number
}

/**
 * 长期记忆提取器
 *
 * 调用 LLM 从用户消息中提取长期有效信息，
 * 排除临时问题 / 一次性需求 / 普通闲聊。
 */
@Injectable()
export class MemoryExtractorService {
  private readonly logger = new Logger(MemoryExtractorService.name)
  private readonly extractorPrompt: string

  constructor(private readonly llmService: LLMService) {
    this.extractorPrompt = this.loadPrompt()
  }

  /**
   * 从用户消息中提取结构化记忆
   * 使用已解析的模型配置（含凭据），与聊天使用同一 LLM Provider
   * 提取失败返回空数组，不影响聊天流程
   */
  async extractMemories(
    userMessage: string,
    resolvedConfig: ResolvedModelConfig,
    runtimeConfig?: Partial<RuntimeModelConfig>
  ): Promise<MemoryEntryData[]> {
    this.logger.log(`[MemoryExtractor] Start extracting from: "${userMessage.substring(0, 80)}"`)

    try {
      if (!this.extractorPrompt) {
        this.logger.warn('[MemoryExtractor] Prompt unavailable, extraction skipped')
        return []
      }

      const response = await this.llmService.chat([
        {
          role: 'system',
          content: this.extractorPrompt
        },
        {
          role: 'user',
          content: `请分析以下用户消息，提取值得长期记忆的信息：\n\n"${userMessage}"\n\n请以 JSON 数组格式返回，如果没有值得记忆的信息，返回空数组 []。`
        }
      ], resolvedConfig, runtimeConfig)

      const rawContent = response.content.trim()
      this.logger.log(`[MemoryExtractor] LLM response received (${rawContent.length} chars)`)

      // 响应过短，直接跳过（如 "[]" 或空内容）
      if (rawContent.length < 3) {
        this.logger.log(`[MemoryExtractor] Response too short, 0 entries. Raw: "${rawContent}"`)
        return []
      }

      // 尝试多种方式提取 JSON 数组
      const entries = this.parseEntries(rawContent)

      if (!entries) {
        this.logger.log(`[MemoryExtractor] JSON parse failed. Raw: "${rawContent.substring(0, 200)}"`)
        return []
      }

      if (!Array.isArray(entries)) {
        this.logger.log(`[MemoryExtractor] Parsed result is not an array. Raw: "${rawContent.substring(0, 200)}"`)
        return []
      }

      // 校验数据格式
      const valid = entries.filter((entry): entry is MemoryEntryData => this.isValidEntry(entry))

      if (valid.length > 0) {
        this.logger.log(`[MemoryExtractor] Extracted ${valid.length} memories: ${valid.map((m) => `[${m.type}] ${m.content}`).join(', ')}`)
      } else {
        this.logger.log(`[MemoryExtractor] ${entries.length} entries parsed but 0 passed validation`)
      }

      return valid
    } catch (error) {
      this.logger.warn('[MemoryExtractor] Extraction failed (non-blocking):', error)
      return []
    }
  }

  /**
   * 多策略解析 LLM 响应中的 JSON 数组
   * 返回解析后的数组或 null
   */
  private parseEntries(raw: string): MemoryEntryData[] | null {
    // 策略 1：整个响应就是合法的 JSON 数组
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    } catch {
      // 继续尝试其他策略
    }

    // 策略 2：正则提取第一个 JSON 数组 [...]
    const arrayMatch = raw.match(/\[[\s\S]*\]/)
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[0])
        if (Array.isArray(parsed)) return parsed
      } catch {
        // 继续尝试
      }
    }

    // 策略 3：提取 markdown 代码块中的 JSON
    const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      const inner = codeBlockMatch[1].trim()
      // 先尝试直接解析
      try {
        const parsed = JSON.parse(inner)
        if (Array.isArray(parsed)) return parsed
      } catch {
        // 再尝试在代码块内匹配数组
        const innerMatch = inner.match(/\[[\s\S]*\]/)
        if (innerMatch) {
          try {
            const parsed = JSON.parse(innerMatch[0])
            if (Array.isArray(parsed)) return parsed
          } catch {
            // 所有策略均失败
          }
        }
      }
    }

    return null
  }

  private isValidEntry(entry: unknown): entry is MemoryEntryData {
    if (!entry || typeof entry !== 'object') return false

    const candidate = entry as Partial<MemoryEntryData>
    return (
      typeof candidate.type === 'string' &&
      MEMORY_TYPES.includes(candidate.type as MemoryType) &&
      typeof candidate.content === 'string' &&
      candidate.content.trim().length > 0 &&
      candidate.content.trim().length <= 80 &&
      typeof candidate.importance === 'number' &&
      candidate.importance >= 0 &&
      candidate.importance <= 1 &&
      typeof candidate.confidence === 'number' &&
      candidate.confidence >= 0 &&
      candidate.confidence <= 1
    )
  }

  private loadPrompt(): string {
    try {
      const filePath = path.join(__dirname, '..', '..', 'prompts', 'memory-extraction.txt')
      const content = fs.readFileSync(filePath, 'utf-8').trim()
      this.logger.log(`[MemoryExtractor] Loaded prompt (${content.length} chars)`)
      return content
    } catch (error) {
      this.logger.warn(`Failed to load memory extraction prompt: ${(error as Error).message}`)
      return ''
    }
  }
}
