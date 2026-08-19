import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CharacterState } from './entities/character-state.entity'
import { RelationshipHistory } from './entities/relationship-history.entity'
import { RelationshipMilestone } from './entities/relationship-milestone.entity'
import { RelationshipSignal } from './relationship-engine.service'

export interface RelationshipProfile {
  state: CharacterState
  days_known: number
  history: RelationshipHistory[]
  milestones: RelationshipMilestone[]
}

@Injectable()
export class RelationshipEvolutionService {
  constructor(
    @InjectRepository(RelationshipHistory)
    private readonly historyRepo: Repository<RelationshipHistory>,
    @InjectRepository(RelationshipMilestone)
    private readonly milestoneRepo: Repository<RelationshipMilestone>
  ) {}

  async reset(characterId: string): Promise<void> {
    await this.historyRepo.delete({ character_id: characterId })
    await this.milestoneRepo.delete({ character_id: characterId })
  }

  async recordLevelChange(
    characterId: string,
    oldLevel: CharacterState['relationship_level'],
    newLevel: CharacterState['relationship_level'],
    reason: string
  ): Promise<void> {
    await this.historyRepo.save(this.historyRepo.create({
      character_id: characterId,
      old_level: oldLevel,
      new_level: newLevel,
      reason
    }))
  }

  async ensureMilestones(state: CharacterState, signals: RelationshipSignal[]): Promise<void> {
    const daysKnown = Math.max(1, Math.floor((Date.now() - state.created_at.getTime()) / 86_400_000) + 1)
    const candidates = [
      state.interaction_count >= 1 ? { code: 'first_interaction', title: '初次交谈', description: '你们开始了第一段对话。' } : null,
      daysKnown >= 7 ? { code: 'known_7_days', title: '相识一周', description: '你们已经相识满 7 天。' } : null,
      daysKnown >= 30 ? { code: 'known_30_days', title: '相识一月', description: '你们已经相识满 30 天。' } : null,
      state.interaction_count >= 30 ? { code: 'thirty_interactions', title: '三十次交流', description: '你们累计完成了 30 次交流。' } : null,
      signals.includes('interest_share') ? { code: 'first_interest_shared', title: '第一次分享兴趣', description: '用户分享了自己的兴趣与偏好。' } : null,
      signals.includes('important_event') || signals.includes('personal_share') ? { code: 'important_support', title: '重要时刻的陪伴', description: '角色陪伴用户谈过重要经历或事件。' } : null
    ].filter((candidate): candidate is { code: string; title: string; description: string } => candidate !== null)

    if (candidates.length === 0) return
    const existing = await this.milestoneRepo.find({
      where: { character_id: state.character_id },
      select: ['code']
    })
    const existingCodes = new Set(existing.map((milestone) => milestone.code))
    const additions = candidates
      .filter((candidate) => !existingCodes.has(candidate.code))
      .map((candidate) => this.milestoneRepo.create({ character_id: state.character_id, ...candidate }))

    if (additions.length > 0) await this.milestoneRepo.save(additions)
  }

  async getProfile(state: CharacterState): Promise<RelationshipProfile> {
    const [history, milestones] = await Promise.all([
      this.historyRepo.find({ where: { character_id: state.character_id }, order: { created_at: 'DESC' } }),
      this.milestoneRepo.find({ where: { character_id: state.character_id }, order: { achieved_at: 'DESC' } })
    ])
    return {
      state,
      days_known: Math.max(1, Math.floor((Date.now() - state.created_at.getTime()) / 86_400_000) + 1),
      history,
      milestones
    }
  }
}
