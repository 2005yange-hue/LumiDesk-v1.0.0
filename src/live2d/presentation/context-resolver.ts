import type { CharacterMood, PetDetectedEmotion, ResponseAttitude } from '../live2d.types'

export function resolveResponseAttitude(emotion: PetDetectedEmotion | undefined, mood: CharacterMood = 'calm'): ResponseAttitude {
  if (emotion === 'happy') return 'celebrate'
  if (emotion === 'sad' || emotion === 'anxious' || emotion === 'angry' || emotion === 'tired') return 'comfort'
  if (mood === 'happy') return 'celebrate'
  return 'neutral'
}
