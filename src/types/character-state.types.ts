export type CharacterMood = 'happy' | 'calm' | 'concerned' | 'tired'
export type CharacterRelationshipLevel =
  | 'stranger'
  | 'familiar'
  | 'friend'
  | 'intimate'
  | 'special'

export interface CharacterState {
  id: number
  character_id: string
  mood: CharacterMood
  energy: number
  affinity: number
  relationship_level: CharacterRelationshipLevel
  initiative_level: number
  interaction_count: number
  shared_experience_count: number
  last_interaction_at: string | null
  created_at: string
  updated_at: string
}

export const CHARACTER_MOOD_LABELS: Record<CharacterMood, string> = {
  happy: '愉快',
  calm: '平静',
  concerned: '关切',
  tired: '疲惫'
}

export const CHARACTER_RELATIONSHIP_LABELS: Record<CharacterRelationshipLevel, string> = {
  stranger: '陌生',
  familiar: '熟悉',
  friend: '朋友',
  intimate: '亲密',
  special: '特殊关系'
}
