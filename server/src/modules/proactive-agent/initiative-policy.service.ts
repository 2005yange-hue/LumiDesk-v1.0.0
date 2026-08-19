import { Injectable } from '@nestjs/common'
import { CharacterRelationshipLevel, CharacterState } from '../character-state/entities/character-state.entity'

const RELATIONSHIP_MULTIPLIERS: Record<CharacterRelationshipLevel, number> = {
  stranger: 0.3,
  familiar: 0.5,
  friend: 0.7,
  intimate: 1,
  special: 1
}

/** 根据角色关系与主动性等级计算是否允许发出主动消息。 */
@Injectable()
export class InitiativePolicyService {
  getEffectiveInitiative(state: Pick<CharacterState, 'initiative_level' | 'relationship_level'>): number {
    const base = Math.max(0, Math.min(100, state.initiative_level))
    return Math.round(base * RELATIONSHIP_MULTIPLIERS[state.relationship_level])
  }

  canInitiate(state: Pick<CharacterState, 'initiative_level' | 'relationship_level'>): boolean {
    return this.getEffectiveInitiative(state) >= 30
  }
}
