import type { PetDetectedEmotion } from './live2d.types'

export interface PetEmotionSignal {
  emotion: PetDetectedEmotion
  intensity: number
}

export function inferPetEmotion(content: string): PetEmotionSignal {
  const normalized = content.toLowerCase()
  const matches = (pattern: RegExp): number => normalized.match(pattern)?.length ?? 0
  const negative = matches(/难过|伤心|悲伤|低落|崩溃|焦虑|压力|紧张|害怕|担心|烦|生气|愤怒|委屈|孤独/g)
  const tired = matches(/累|疲惫|困|熬夜|没精神|精疲力尽/g)
  const positive = matches(/开心|高兴|快乐|太好了|兴奋|喜欢|幸福|顺利|成功|谢谢|感谢/g)
  if (negative > 0) {
    const emotion: PetDetectedEmotion = /生气|愤怒|烦/.test(normalized) ? 'angry' : /焦虑|压力|紧张|害怕|担心/.test(normalized) ? 'anxious' : 'sad'
    return { emotion, intensity: Math.min(5, 2 + negative) }
  }
  if (tired > 0) return { emotion: 'tired', intensity: Math.min(5, 2 + tired) }
  if (positive > 0) return { emotion: 'happy', intensity: Math.min(5, 1 + positive) }
  return { emotion: 'calm', intensity: 1 }
}
