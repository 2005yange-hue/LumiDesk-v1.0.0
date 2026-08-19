import type { CharacterMood, IntensityCurve, PresentationState, ResponseAttitude } from '../live2d.types'

export interface PersonalityPresentation {
  expression?: string
  motion?: string
  curve: IntensityCurve
  motionQueue?: Array<{ name: string, loop: boolean }>
}

export type PersonalityPresentationKey = PresentationState | CharacterMood | ResponseAttitude | 'interact' | 'listening' | 'waiting' | 'typing' | 'speaking'

const DEFAULT_STYLE: Record<string, PersonalityPresentation> = {
  idle: { expression: 'calm', motion: 'idle', curve: 'linear' },
  calm: { expression: 'calm', motion: 'idle', curve: 'linear' },
  happy: { expression: 'happy', motion: 'idle', curve: 'linear' },
  concerned: { expression: 'concerned', motion: 'idle', curve: 'soft' },
  tired: { expression: 'tired', motion: 'idle', curve: 'soft' },
  excited: { expression: 'happy', motion: 'idle', curve: 'easeOut' },
  thinking: { expression: 'calm', motion: 'thinking', curve: 'linear' },
  speaking: { expression: 'calm', motion: 'speaking', curve: 'linear' },
  listening: { expression: 'calm', motion: 'idle', curve: 'linear' },
  waiting: { expression: 'calm', motion: 'thinking', curve: 'linear' },
  typing: { expression: 'calm', motion: 'thinking', curve: 'linear' },
  interact: { expression: 'happy', motion: 'interact', curve: 'easeOut' },
  comfort: { expression: 'concerned', motion: 'idle', curve: 'soft' },
  encourage: { expression: 'happy', motion: 'idle', curve: 'easeOut' },
  celebrate: { expression: 'happy', motion: 'positive', curve: 'easeOut' },
  neutral: { expression: 'calm', motion: 'idle', curve: 'linear' }
}

const COLD_LADY_STYLE: Record<string, PersonalityPresentation> = {
  ...DEFAULT_STYLE,
  happy: { expression: 'happy', motion: 'idle', curve: 'soft' },
  comfort: { expression: 'concerned', motion: 'idle', curve: 'soft' },
  celebrate: { expression: 'happy', motion: 'interact', curve: 'soft' }
}

const ENERGETIC_STYLE: Record<string, PersonalityPresentation> = {
  ...DEFAULT_STYLE,
  happy: { expression: 'happy', motion: 'positive', curve: 'easeOut' },
  celebrate: { expression: 'happy', motion: 'positive', curve: 'easeOut', motionQueue: [{ name: 'interact', loop: false }] },
  encourage: { expression: 'happy', motion: 'positive', curve: 'easeOut' }
}

const GENTLE_STYLE: Record<string, PersonalityPresentation> = {
  ...DEFAULT_STYLE,
  comfort: { expression: 'concerned', motion: 'idle', curve: 'soft' },
  encourage: { expression: 'happy', motion: 'idle', curve: 'soft' }
}

const STYLES: Record<string, Record<string, PersonalityPresentation>> = {
  default: DEFAULT_STYLE,
  cold_lady: COLD_LADY_STYLE,
  energetic: ENERGETIC_STYLE,
  gentle: GENTLE_STYLE
}

export function resolvePersonalityPresentation(styleId: string, state: PersonalityPresentationKey): PersonalityPresentation {
  const style = STYLES[styleId] ?? DEFAULT_STYLE
  return style[state] ?? DEFAULT_STYLE[state] ?? DEFAULT_STYLE.idle
}
