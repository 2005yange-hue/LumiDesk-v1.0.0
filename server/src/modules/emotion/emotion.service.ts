import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import { LLMMessage } from '../llm/llm-adapter.interface'
import { LLMService } from '../llm/llm.service'
import { ResolvedModelConfig, RuntimeModelConfig } from '../llm/llm-types'
import { EmotionType, EMOTION_TYPES } from './entities/emotion-record.entity'
import { EmotionPreferenceService } from './emotion-preference.service'
import { EmotionRecordService } from './emotion-record.service'
import { EmotionRuleResult, EmotionRuleService } from './emotion-rule.service'

interface EmotionModelResult {
  shouldRecord: boolean
  emotion?: EmotionType
  intensity?: number
  confidence?: number
  reason?: string
}

@Injectable()
export class EmotionService {
  private readonly logger = new Logger(EmotionService.name)
  private readonly analysisPrompt: string

  constructor(
    private readonly llmService: LLMService,
    private readonly preferenceService: EmotionPreferenceService,
    private readonly recordService: EmotionRecordService,
    private readonly ruleService: EmotionRuleService
  ) {
    this.analysisPrompt = this.loadPrompt()
  }

  async analyzeCompletedMessage(
    userMessage: string,
    resolvedConfig: ResolvedModelConfig,
    runtimeConfig: Partial<RuntimeModelConfig> | undefined,
    characterId: string | undefined,
    conversationId: string | undefined,
    userMessageId: string
  ): Promise<void> {
    if (!characterId || this.ruleService.isHighRisk(userMessage) || !(await this.preferenceService.isEnabled())) return

    const fallback = this.ruleService.detect(userMessage)
    const modelResult = await this.analyzeWithModel(userMessage, resolvedConfig, runtimeConfig)
    const selected = this.selectResult(modelResult, fallback)
    if (!selected) return

    await this.recordService.upsertAutomatic({
      characterId,
      conversationId,
      userMessageId,
      emotion: selected.emotion,
      intensity: selected.intensity,
      confidence: selected.confidence,
      source: selected.source,
      reason: selected.reason
    })
  }

  private async analyzeWithModel(
    userMessage: string,
    resolvedConfig: ResolvedModelConfig,
    runtimeConfig?: Partial<RuntimeModelConfig>
  ): Promise<EmotionModelResult | null> {
    if (!this.analysisPrompt) return null
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: this.analysisPrompt
      },
      { role: 'user', content: userMessage }
    ]
    try {
      const response = await this.llmService.chat(messages, resolvedConfig, { ...runtimeConfig, temperature: 0, maxTokens: 180 })
      return this.parseModelResult(response.content)
    } catch (error) {
      this.logger.warn('Emotion model analysis failed; falling back to rules:', error)
      return null
    }
  }

  private selectResult(modelResult: EmotionModelResult | null, fallback: EmotionRuleResult | null): (EmotionRuleResult & { source: 'rule' | 'llm' }) | null {
    if (modelResult?.shouldRecord && modelResult.emotion && modelResult.intensity && modelResult.confidence !== undefined && modelResult.confidence >= 0.6) {
      return {
        emotion: modelResult.emotion,
        intensity: modelResult.intensity,
        confidence: modelResult.confidence,
        reason: modelResult.reason || '模型识别到明确情绪表达',
        source: 'llm'
      }
    }
    return fallback ? { ...fallback, source: 'rule' } : null
  }

  private parseModelResult(content: string): EmotionModelResult | null {
    const json = this.extractJson(content)
    if (!json) return null
    try {
      const value: unknown = JSON.parse(json)
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null
      const record = value as Record<string, unknown>
      if (typeof record.shouldRecord !== 'boolean') return null
      if (!record.shouldRecord) return { shouldRecord: false }
      if (typeof record.emotion !== 'string' || !EMOTION_TYPES.includes(record.emotion as EmotionType)) return null
      if (typeof record.intensity !== 'number' || !Number.isInteger(record.intensity) || record.intensity < 1 || record.intensity > 5) return null
      if (typeof record.confidence !== 'number' || record.confidence < 0 || record.confidence > 1) return null
      return {
        shouldRecord: true,
        emotion: record.emotion as EmotionType,
        intensity: record.intensity,
        confidence: record.confidence,
        reason: typeof record.reason === 'string' ? record.reason.trim().slice(0, 240) : undefined
      }
    } catch {
      return null
    }
  }

  private loadPrompt(): string {
    try {
      return fs.readFileSync(path.join(__dirname, '..', '..', 'prompts', 'emotion-analysis.txt'), 'utf-8').trim()
    } catch (error) {
      this.logger.warn(`Failed to load emotion analysis prompt: ${(error as Error).message}`)
      return ''
    }
  }
  private extractJson(content: string): string | null {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    const candidate = (fenced?.[1] || content).trim()
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    return start >= 0 && end > start ? candidate.slice(start, end + 1) : null
  }
}