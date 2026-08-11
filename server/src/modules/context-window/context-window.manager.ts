import { Injectable, Logger } from '@nestjs/common'
import { LLMMessage } from '../llm/llm-adapter.interface'
import { ITokenizer } from './tokenizer.interface'
import { GptTokenizer } from './tokenizers/gpt-tokenizer'
import { getModelContextLimit, OUTPUT_TOKEN_RESERVE } from './context-window.config'

/**
 * 上下文窗口管理器
 *
 * 职责：
 *  - 计算消息总 token 数
 *  - 判断是否超出模型上下文限制
 *  - 按规则裁剪历史消息
 *
 * 不负责：
 *  - LLM 总结（预留 SummaryService 接口，Commit 3 实现）
 *  - 模型调用
 *  - 消息持久化
 */
@Injectable()
export class ContextWindowManager {
  private readonly logger = new Logger(ContextWindowManager.name)
  private readonly tokenizer: ITokenizer

  constructor() {
    this.tokenizer = new GptTokenizer()
  }

  /**
   * 计算消息数组的总 token 数
   */
  countTokens(messages: LLMMessage[]): number {
    let total = 0
    for (const msg of messages) {
      // 每条消息的格式开销约 4 token（role + formatting）
      total += 4 + this.tokenizer.countTokens(msg.content)
    }
    return total
  }

  /**
   * 判断消息是否超出模型上下文窗口
   * @param messages    消息数组
   * @param modelName   模型名（用于查配置表）
   * @returns 超出限制则返回 true
   */
  checkOverflow(messages: LLMMessage[], modelName?: string): boolean {
    const limit = getModelContextLimit(modelName)
    const effectiveLimit = limit - OUTPUT_TOKEN_RESERVE
    const tokens = this.countTokens(messages)
    const overflow = tokens > effectiveLimit

    if (overflow) {
      this.logger.warn(
        `Context overflow: ${tokens}/${effectiveLimit} tokens (model=${modelName || 'default'}, limit=${limit})`
      )
    }

    return overflow
  }

  /**
   * 裁剪消息，确保总 token 数不超过限制
   *
   * 规则：
   *  1. 保留所有 system 消息（不参与裁剪）
   *  2. 按时间从近到远保留 user/assistant 消息
   *  3. 总 token 超过限制时丢弃最早的消息
   *  4. 返回的消息保持原始顺序
   *
   * @param messages  完整消息数组
   * @param modelName 模型名
   * @returns 裁剪后的消息数组
   */
  trimMessages(messages: LLMMessage[], modelName?: string): LLMMessage[] {
    const limit = getModelContextLimit(modelName)
    const effectiveLimit = limit - OUTPUT_TOKEN_RESERVE

    // 分离 system 消息和对话消息
    const systemMessages = messages.filter((m) => m.role === 'system')
    const dialogueMessages = messages.filter((m) => m.role !== 'system')

    // 计算 system 消息占用的 token
    const systemTokens = this.countTokens(systemMessages)
    const availableTokens = effectiveLimit - systemTokens

    if (availableTokens <= 0) {
      this.logger.error('System messages exceed context limit, cannot trim')
      return [...systemMessages, ...dialogueMessages.slice(-2)] // 至少保留最后 2 条
    }

    // 从最新消息开始累积
    const selected: typeof dialogueMessages = []
    let usedTokens = 0

    for (let i = dialogueMessages.length - 1; i >= 0; i--) {
      const msg = dialogueMessages[i]
      const msgTokens = 4 + this.tokenizer.countTokens(msg.content)

      if (usedTokens + msgTokens > availableTokens) {
        break
      }

      selected.unshift(msg) // 保持正序
      usedTokens += msgTokens
    }

    const result = [...systemMessages, ...selected]

    this.logger.log(
      `Trimmed: ${messages.length} → ${result.length} messages ` +
      `(${usedTokens + systemTokens}/${availableTokens} tokens)`
    )

    return result
  }

  /**
   * [预留] 生成历史消息摘要
   *
   * Commit 3 将实现：对裁剪掉的旧消息生成摘要，作为 system 消息注入
   */
  async summarizeMessages(_messages: LLMMessage[]): Promise<string> {
    throw new Error('summarizeMessages not implemented (planned for Commit 3)')
  }
}
