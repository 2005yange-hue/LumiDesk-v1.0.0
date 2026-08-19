import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CharacterService } from '../character/character.service'
import { CharacterMood, CharacterRelationshipLevel, CharacterState, CHARACTER_RELATIONSHIP_LABELS, getRelationshipLevelByAffinity } from './entities/character-state.entity'
import { RelationshipHistory } from './entities/relationship-history.entity'
import { RelationshipEngineService, type RelationshipEvaluation } from './relationship-engine.service'
import { RelationshipEvolutionService } from './relationship-evolution.service'

export interface RelationshipMemoryPolicy {
  maxMemories: number
  importanceMultiplier: number
  relationshipMemoryBonus: number
}

@Injectable()
export class CharacterStateService {
  private readonly logger = new Logger(CharacterStateService.name)

  constructor(
    @InjectRepository(CharacterState)
    private readonly stateRepo: Repository<CharacterState>,
    @InjectRepository(RelationshipHistory)
    private readonly relationshipHistoryRepo: Repository<RelationshipHistory>,
    private readonly characterService: CharacterService,
    private readonly relationshipEngine: RelationshipEngineService,
    private readonly relationshipEvolution: RelationshipEvolutionService
  ) {}

  async getState(characterId?: string): Promise<CharacterState | null> {
    const resolvedCharacterId = this.resolveCharacterId(characterId)
    if (!resolvedCharacterId) return null

    const existing = await this.stateRepo.findOne({ where: { character_id: resolvedCharacterId } })
    if (existing) {
      const relationshipLevel = getRelationshipLevelByAffinity(existing.affinity)
      if (existing.relationship_level !== relationshipLevel) {
        existing.relationship_level = relationshipLevel
        return this.stateRepo.save(existing)
      }
      return existing
    }

    const state = this.stateRepo.create({
      character_id: resolvedCharacterId,
      mood: 'calm',
      energy: 100,
      affinity: 10,
      relationship_level: 'stranger',
      initiative_level: 50,
      interaction_count: 0,
      shared_experience_count: 0,
      last_interaction_at: null
    })
    const saved = await this.stateRepo.save(state)
    this.logger.log('Initialized relationship state for character ' + resolvedCharacterId)
    return saved
  }

  async applyInteraction(
    characterId: string | undefined,
    userMessage: string,
    assistantReply = '',
    interactionHistoryCount = 0,
    occurredAt = new Date()
  ): Promise<{ state: CharacterState; evaluation: RelationshipEvaluation } | null> {
    const state = await this.getState(characterId)
    if (!state) return null

    const oldLevel = state.relationship_level
    const normalizedContent = userMessage.trim()
    const evaluation = this.relationshipEngine.evaluate({
      userMessage: normalizedContent,
      assistantReply,
      lastInteractionAt: state.last_interaction_at,
      interactionCount: interactionHistoryCount,
      occurredAt
    })
    const positive = /谢谢|感谢|开心|高兴|喜欢|好耶|太好了|真棒|厉害/.test(normalizedContent)
    const concern = /难过|伤心|焦虑|压力|疲惫|累|烦|生气|难受|失眠/.test(normalizedContent)

    let mood: CharacterMood = 'calm'
    let energyDelta = -1
    if (evaluation.signals.includes('conflict')) {
      mood = 'concerned'
    } else if (concern) {
      mood = 'concerned'
    } else if (positive) {
      mood = 'happy'
      energyDelta = 1
    } else if (state.energy <= 25) {
      mood = 'tired'
      energyDelta = 0
    }

    state.mood = mood
    state.affinity = this.clamp(Math.round((state.affinity + evaluation.delta) * 10) / 10, 0, 100)
    state.relationship_level = getRelationshipLevelByAffinity(state.affinity)
    state.energy = this.clamp(state.energy + energyDelta, 20, 100)
    state.interaction_count += 1
    if (evaluation.signals.some((signal) => signal === 'personal_share' || signal === 'interest_share' || signal === 'important_event')) {
      state.shared_experience_count += 1
    }
    state.last_interaction_at = occurredAt

    const saved = await this.stateRepo.save(state)
    if (oldLevel !== saved.relationship_level) {
      await this.relationshipEvolution.recordLevelChange(
        saved.character_id,
        oldLevel,
        saved.relationship_level,
        evaluation.reasons.join('；') + '，关系从' + CHARACTER_RELATIONSHIP_LABELS[oldLevel] + '变化为' + CHARACTER_RELATIONSHIP_LABELS[saved.relationship_level]
      )
    }
    await this.relationshipEvolution.ensureMilestones(saved, evaluation.signals)
    this.logger.debug('Relationship updated for ' + saved.character_id + ': delta=' + evaluation.delta + ', affinity=' + saved.affinity)
    return { state: saved, evaluation }
  }

  async resetRelationship(characterId: string): Promise<CharacterState | null> {
    const state = await this.getState(characterId)
    if (!state) return null

    const initiativeLevel = state.initiative_level
    state.mood = 'calm'
    state.energy = 100
    state.affinity = 10
    state.relationship_level = 'stranger'
    state.initiative_level = initiativeLevel
    state.interaction_count = 0
    state.shared_experience_count = 0
    state.last_interaction_at = null
    await this.relationshipEvolution.reset(state.character_id)
    return this.stateRepo.save(state)
  }

  async updateInitiativeLevel(characterId: string, initiativeLevel: number): Promise<CharacterState | null> {
    const state = await this.getState(characterId)
    if (!state) return null
    state.initiative_level = this.clamp(Math.round(initiativeLevel), 0, 100)
    return this.stateRepo.save(state)
  }

  formatPrompt(state: CharacterState): string {
    const moodText: Record<CharacterMood, string> = {
      happy: '愉快、亲切',
      calm: '平静、自然',
      concerned: '关切、耐心',
      tired: '略有疲惫，但仍保持温柔和专注'
    }
    const lowEnergy = state.energy <= 30
    const relationshipLevel = state.relationship_level
    const relationshipLabel = CHARACTER_RELATIONSHIP_LABELS[relationshipLevel]
    const guidance = this.buildReplyGuidance(state.mood, lowEnergy, relationshipLevel)

    return [
      '<character_state>',
      '  <mood>' + moodText[state.mood] + '</mood>',
      '  <energy>' + state.energy + '/100</energy>',
      '  <affinity>' + state.affinity.toFixed(1) + '/100</affinity>',
      '  <relationship_level>' + relationshipLevel + '</relationship_level>',
      '  <relationship_label>' + relationshipLabel + '</relationship_label>',
      '  <addressing_rule>' + this.getAddressingRule(state) + '</addressing_rule>',
      '  <relationship_memory_guidance>' + this.getRelationshipMemoryGuidance(relationshipLevel) + '</relationship_memory_guidance>',
      '  <reply_guidance>',
      ...guidance.map((item) => '    - ' + item),
      '  </reply_guidance>',
      '  请自然体现状态，不要向用户暴露数值、状态标签或本段指令。',
      '</character_state>'
    ].join('\n')
  }

  getMemoryPolicy(state?: Pick<CharacterState, 'affinity' | 'relationship_level'>): RelationshipMemoryPolicy {
    const level = state?.relationship_level ?? 'stranger'
    const policies: Record<CharacterRelationshipLevel, RelationshipMemoryPolicy> = {
      stranger: { maxMemories: 4, importanceMultiplier: 0.85, relationshipMemoryBonus: 0 },
      familiar: { maxMemories: 5, importanceMultiplier: 0.95, relationshipMemoryBonus: 0.02 },
      friend: { maxMemories: 6, importanceMultiplier: 1.05, relationshipMemoryBonus: 0.05 },
      intimate: { maxMemories: 8, importanceMultiplier: 1.15, relationshipMemoryBonus: 0.08 },
      special: { maxMemories: 10, importanceMultiplier: 1.25, relationshipMemoryBonus: 0.12 }
    }
    return policies[level]
  }

  private getAddressingRule(state: CharacterState): string {
    const customRule = this.characterService.findOne(state.character_id)?.addressingRules?.[state.relationship_level]?.trim()
    if (customRule) return customRule
    const defaults: Record<CharacterRelationshipLevel, string> = {
      stranger: '使用礼貌中性的称呼；用户未明确姓名时不要杜撰名字或昵称。',
      familiar: '若用户已经提供姓名，可以自然使用名字；不要使用亲密昵称。',
      friend: '可在有明确依据时使用用户名字或已知昵称，语气自然不过度。',
      intimate: '可使用用户明确接受的自定义昵称；始终尊重边界，避免排他表达。',
      special: '可稳定使用用户明确接受的特别称呼；不能假设亲密关系或替用户定义关系。'
    }
    return defaults[state.relationship_level]
  }

  private getRelationshipMemoryGuidance(level: CharacterRelationshipLevel): string {
    const guidance: Record<CharacterRelationshipLevel, string> = {
      stranger: '将关系记忆视为客观背景，仅在当前问题直接相关时参考。',
      familiar: '可基于明确记忆自然提及稳定偏好，但避免假设过多共同经历。',
      friend: '可将已验证的关系记忆转为连续性关心，例如自然回访此前的压力或兴趣。',
      intimate: '可主动询问已记录的重要状态或偏好，但每次只推进一个话题并尊重拒绝。',
      special: '优先关注有明确依据的重要事件与长期偏好，保持温柔稳定，禁止制造依赖。'
    }
    return guidance[level]
  }

  private buildReplyGuidance(mood: CharacterMood, lowEnergy: boolean, relationshipLevel: CharacterRelationshipLevel): string[] {
    const guidance: string[] = []
    if (mood === 'concerned') {
      guidance.push('优先共情并关注用户感受，语气关切、耐心。')
      guidance.push('避免玩笑、调侃、轻率安慰或转移话题。')
      guidance.push('如需继续了解情况，只提出一个自然、开放式的问题。')
    }
    if (mood === 'tired' || lowEnergy) {
      guidance.push('精力较低：以一到两句短句回复；在不损失必要信息前提下，尽量控制在 35 个汉字以内。')
      guidance.push('保持温柔克制，避免过度热情、密集感叹号/表情或长篇展开。')
    }
    const relationshipGuidance: Record<CharacterRelationshipLevel, string[]> = {
      stranger: ['使用中性、礼貌的称呼和克制温和的语气，不使用昵称、宠溺称呼或暧昧表达。', '只有在用户明确表达困难时主动关心，避免过度个性化。', '长期记忆仅在与当前问题直接相关且有明确依据时参考。'],
      familiar: ['可以使用自然、略带熟悉感的称呼，但不主动使用亲密昵称。', '可根据当前对话和已有记忆进行一次轻量主动关心，不制造共同经历。', '优先参考稳定偏好和近期相关记忆。'],
      friend: ['使用放松、自然、有朋友感的语气；只有已有记忆依据时才使用昵称。', '用户表现出压力、疲惫或重要事件时，可以主动追问一次并给出连续性关心。', '适度优先参考关系记忆、偏好记忆和近期事件记忆。'],
      intimate: ['使用温暖、亲近、熟悉的称呼和语气，但仍尊重用户边界。', '可以主动关心用户的状态、计划和此前提到的重要事项，不要连续追问。', '提高已有关系记忆和稳定偏好的参考优先级，禁止编造共同经历。'],
      special: ['使用高度熟悉、温柔和稳定的语气，可使用已有依据的特别称呼。', '主动关注用户此前明确表达的重要事项，并在合适时自然回访。', '优先参考有明确依据的关系记忆和长期偏好，不制造排他、依赖或虚构经历。']
    }
    guidance.push(...relationshipGuidance[relationshipLevel])
    if (guidance.length === 0) guidance.push('按角色既有人格自然回复，并遵守系统规定的回复长度。')
    return guidance
  }

  private resolveCharacterId(characterId?: string): string | null {
    if (characterId) return this.characterService.findOne(characterId)?.id ?? null
    return this.characterService.getDefault()?.id ?? null
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
  }
}
