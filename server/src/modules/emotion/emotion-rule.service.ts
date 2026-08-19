import { Injectable } from '@nestjs/common'
import { EmotionType } from './entities/emotion-record.entity'

export interface EmotionRuleResult {
  emotion: EmotionType
  intensity: number
  confidence: number
  reason: string
}

const HIGH_RISK_PATTERN = /(自杀|自殘|自残|不想活|活不下去|结束生命|結束生命|想死|去死|割腕|伤害自己|傷害自己)/i

const EMOTION_RULES: Array<{ emotion: EmotionType; pattern: RegExp; intensity: number; reason: string }> = [
  { emotion: 'anxious', pattern: /(焦虑|焦慮|紧张|緊張|担心|壓力|压力|害怕|慌|不安|崩溃|崩潰)/i, intensity: 4, reason: '检测到焦虑或压力相关表达' },
  { emotion: 'sad', pattern: /(难过|難過|伤心|傷心|低落|委屈|失落|哭了|孤独|孤單|沮丧|沮喪)/i, intensity: 4, reason: '检测到低落或难过相关表达' },
  { emotion: 'angry', pattern: /(生气|生氣|愤怒|憤怒|烦死|煩死|气死|氣死|讨厌|討厭|火大)/i, intensity: 4, reason: '检测到愤怒或烦躁相关表达' },
  { emotion: 'tired', pattern: /(好累|很累|疲惫|疲憊|困死|熬夜|没精神|沒精神|精疲力尽|精疲力盡)/i, intensity: 3, reason: '检测到疲惫相关表达' },
  { emotion: 'happy', pattern: /(开心|開心|高兴|高興|幸福|太好了|顺利|順利|兴奋|興奮|快乐|快樂)/i, intensity: 3, reason: '检测到积极情绪表达' },
  { emotion: 'calm', pattern: /(平静|平靜|还好|還好|正常|没事|沒事|放松|放鬆|安心)/i, intensity: 2, reason: '检测到平静状态表达' }
]

@Injectable()
export class EmotionRuleService {
  isHighRisk(content: string): boolean {
    return HIGH_RISK_PATTERN.test(content)
  }

  detect(content: string): EmotionRuleResult | null {
    const normalized = content.trim()
    if (!normalized || this.isHighRisk(normalized)) return null
    const matched = EMOTION_RULES.find((rule) => rule.pattern.test(normalized))
    if (!matched) return null

    const intensity = /特别|非常|真的|太|好.*?累|快.*?崩|很/i.test(normalized)
      ? Math.min(5, matched.intensity + 1)
      : matched.intensity
    return { emotion: matched.emotion, intensity, confidence: 0.72, reason: matched.reason }
  }

  getSafetyGuidance(content: string): string | null {
    if (!this.isHighRisk(content)) return null
    return '<safety_support>用户的当前表达可能涉及自我伤害或自杀风险。请立即以平静、关怀且不评判的语气回应：先确认对方此刻的安全，鼓励其联系身边可信赖的人、当地紧急服务或危机支持资源；如果存在迫切危险，建议立即拨打当地紧急电话。不要诊断、不要淡化感受、不要承诺线下干预，也不要把风险内容当作普通闲聊继续推进。</safety_support>'
  }
}