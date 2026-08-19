import { Injectable } from '@nestjs/common'

export type RelationshipSignal = 'regular_chat' | 'personal_share' | 'gratitude' | 'conflict' | 'long_absence' | 'interest_share' | 'important_event'

export interface RelationshipEvaluationInput {
  userMessage: string
  assistantReply: string
  lastInteractionAt: Date | null
  interactionCount: number
  occurredAt?: Date
}

export interface RelationshipEvaluation {
  delta: number
  reasons: string[]
  signals: RelationshipSignal[]
}

@Injectable()
export class RelationshipEngineService {
  evaluate(input: RelationshipEvaluationInput): RelationshipEvaluation {
    const content = input.userMessage.trim()
    const reasons = ['自然交流']
    const signals: RelationshipSignal[] = ['regular_chat']
    let delta = 0.1

    if (/(谢谢|感谢|多亏|帮了我)/.test(content)) {
      delta += 1
      reasons.push('表达感谢')
      signals.push('gratitude')
    }

    if (/(小时候|其实我|一直以来|家人|父母|朋友|恋人|害怕|秘密|经历|心事)/.test(content)) {
      delta += 2
      reasons.push('分享个人经历')
      signals.push('personal_share')
    }

    if (/(喜欢|爱好|游戏|电影|音乐|阅读|运动|旅行|编程|开发)/.test(content)) {
      signals.push('interest_share')
    }

    if (/(考试|面试|答辩|毕业设计|生病|失业|分手|重要)/.test(content)) {
      signals.push('important_event')
    }

    if (/(别烦|闭嘴|讨厌你|别再说|不想和你聊|你根本不懂)/.test(content)) {
      delta -= 3
      reasons.push('出现明确冲突')
      signals.push('conflict')
    }

    if (input.lastInteractionAt) {
      const gapDays = ((input.occurredAt?.getTime() ?? Date.now()) - input.lastInteractionAt.getTime()) / 86_400_000
      if (gapDays >= 14) {
        delta -= 0.5
        reasons.push('长时间未互动')
        signals.push('long_absence')
      }
    }

    if (!input.assistantReply.trim()) delta = Math.min(delta, 0)

    return {
      delta: Math.round(delta * 10) / 10,
      reasons: [...new Set(reasons)],
      signals: [...new Set(signals)]
    }
  }
}
