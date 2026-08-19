import type { CharacterRelationshipLevel, CharacterState } from './character-state.types'

export interface RelationshipHistoryEntry {
  id: number
  character_id: string
  old_level: CharacterRelationshipLevel
  new_level: CharacterRelationshipLevel
  reason: string
  created_at: string
}

export interface RelationshipMilestone {
  id: number
  character_id: string
  code: string
  title: string
  description: string
  achieved_at: string
}

export interface RelationshipProfile {
  state: CharacterState
  days_known: number
  history: RelationshipHistoryEntry[]
  milestones: RelationshipMilestone[]
}
