import { Injectable, Logger } from '@nestjs/common'
import { LLMService } from '../llm/llm.service'

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
   * 提取失败返回空数组，不影响聊天流程
   */
  async extractMemories(userMessage: string): Promise<MemoryEntryData[]> {
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
      ])

      const jsonMatch = response.content.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        this.logger.log('No extractable memories found in LLM response')
        return []
      }

      const entries: MemoryEntryData[] = JSON.parse(jsonMatch[0])

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
        this.logger.log(`Extracted ${valid.length} memories: ${valid.map((m) => m.type).join(', ')}`)
      }

      return valid
    } catch (error) {
      this.logger.warn('Memory extraction failed (non-blocking):', error)
      return []
    }
  }
}

const EXTRACTOR_SYSTEM_PROMPT = `你是一个信息提取助手。分析用户消息，提取值得长期记忆的信息。

应该提取的信息类型：
- personal: 用户身份信息（名字、职业、年龄、学习方向等）
- preference: 用户偏好（喜欢的游戏、语言、工具、食物等）
- habit: 用户习惯（编程习惯、工作方式、作息等）
- interest: 用户兴趣（技术方向、爱好等）
- goal: 用户长期目标

不要提取：
- 临时问题（"这个bug怎么修"）
- 一次性需求（"帮我写个函数"）
- 普通闲聊（"你好""今天天气不错"）
- 错误日志或代码片段

输出格式（严格 JSON 数组，不要其他文字）：
[
  { "type": "preference", "content": "用户喜欢使用C++开发游戏", "importance": 0.8 },
  { "type": "personal", "content": "用户的名字是小明", "importance": 0.9 }
]

importance 取值 0-1：
- 0.9-1.0: 核心身份信息
- 0.7-0.8: 明确偏好或长期目标
- 0.4-0.6: 一般兴趣或习惯
- 0.1-0.3: 弱信号信息

如果没有值得记忆的信息，返回：[]`
