import { Injectable, Logger } from '@nestjs/common'
import { LLMService } from '../llm/llm.service'
import { RuntimeModelConfig, ResolvedModelConfig } from '../llm/llm-types'

export interface MemoryEntryData {
  type: string
  content: string
  importance: number
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

  constructor(private readonly llmService: LLMService) {}

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
      const response = await this.llmService.chat([
        {
          role: 'system',
          content: EXTRACTOR_SYSTEM_PROMPT
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
      const valid = entries.filter(
        (e) =>
          e.type &&
          e.content &&
          typeof e.importance === 'number' &&
          e.importance >= 0 &&
          e.importance <= 1
      )

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
}

const EXTRACTOR_SYSTEM_PROMPT = `你是「AI 长期记忆提取模块」。你的唯一任务是分析用户消息，判断是否包含值得长期记住的信息，并以严格的 JSON 数组格式返回。

==== 提取规则 ====

应该提取（长期有效的信息）：
- fact: 用户事实信息（名字、职业、年龄、学历、所在地、学习/工作背景等）
- preference: 用户偏好（喜欢的编程语言、工具、游戏、食物、音乐、颜色等）
- habit: 用户习惯（编程习惯、工作节奏、作息、沟通风格等）
- interest: 用户兴趣（技术方向、爱好、关注领域等）

不应该提取（一次性 / 临时 / 无长期价值）：
- 临时问题（"这个 bug 怎么修"、"帮我写个函数"）
- 一次性需求（"写个排序算法"、"翻译这段文字"）
- 普通闲聊（"你好"、"今天天气不错"、"谢谢"）
- 代码片段、错误日志、调试信息及其内容
- 对当前对话流程的指令性请求

==== 输出格式（绝对严格）====

你必须且只能输出一个 JSON 数组，不要有任何解释文字、前言、后缀或 markdown 标记。

格式示例：
[{"type":"preference","content":"用户喜欢使用 C++ 开发游戏","importance":0.8},{"type":"fact","content":"用户的名字是小明","importance":0.9}]

字段说明：
- type: 必须是 "fact" | "preference" | "habit" | "interest" 之一
- content: 简洁的一句话描述（中文，≤50字）
- importance: 0-1 的浮点数，表示这条信息的重要程度
  0.9-1.0: 核心身份信息（姓名、职业等）
  0.7-0.8: 明确偏好或长期目标
  0.4-0.6: 一般兴趣或习惯
  0.1-0.3: 弱信号信息

如果没有值得长期记忆的信息，你必须返回：[]`
