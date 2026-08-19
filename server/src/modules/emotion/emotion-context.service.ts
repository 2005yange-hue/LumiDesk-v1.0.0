import { Injectable } from '@nestjs/common'
import { EmotionPreferenceService } from './emotion-preference.service'
import { EmotionRecordService } from './emotion-record.service'
import { EmotionRuleService } from './emotion-rule.service'

const EMOTION_LABELS: Record<string, string> = {
  happy: '愉快',
  calm: '平静',
  anxious: '焦虑',
  sad: '低落',
  angry: '烦躁',
  tired: '疲惫'
}

@Injectable()
export class EmotionContextService {
  constructor(
    private readonly preferenceService: EmotionPreferenceService,
    private readonly recordService: EmotionRecordService,
    private readonly ruleService: EmotionRuleService
  ) {}

  async buildStoredContext(characterId?: string): Promise<string | null> {
    if (!characterId || !(await this.preferenceService.isEnabled())) return null
    try {
      const summary = await this.recordService.getSummary(characterId)
      if (!summary.primaryEmotion || summary.recentCount === 0) return null

      const intensityLabel = summary.averageIntensity >= 4 ? '较强' : summary.averageIntensity >= 3 ? '明显' : '轻微'
      return `<user_emotion_context>这是对用户近期状态的非诊断性观察：近 7 天主要呈现${EMOTION_LABELS[summary.primaryEmotion] || summary.primaryEmotion}（${intensityLabel}），共 ${summary.recentCount} 条相关记录。请自然、克制地调整语气；不要把该观察当作事实贴标签，不要主动提及“系统判断”，除非用户自己愿意谈论感受。</user_emotion_context>`
    } catch {
      return null
    }
  }

  buildImmediateSafetyContext(userMessage: string): string | null {
    return this.ruleService.getSafetyGuidance(userMessage)
  }
}