import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'
import { CharacterService } from '../character/character.service'
import { Conversation } from '../memory/entities/conversation.entity'
import { Message } from '../memory/entities/message.entity'
import { CharacterStateService } from './character-state.service'
import { RelationshipInteraction } from './entities/relationship-interaction.entity'

export interface RelationshipInteractionInput {
  characterId?: string
  conversationId: string
  userMessageId: string
  assistantMessageId?: string | null
  userMessage: string
  assistantReply: string
  occurredAt?: Date
}

@Injectable()
export class RelationshipInteractionService {
  private readonly logger = new Logger(RelationshipInteractionService.name)

  constructor(
    @InjectRepository(RelationshipInteraction)
    private readonly interactionRepo: Repository<RelationshipInteraction>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    private readonly characterStateService: CharacterStateService,
    private readonly characterService: CharacterService
  ) {}

  async record(input: RelationshipInteractionInput): Promise<void> {
    const characterId = this.resolveCharacterId(input.characterId)
    if (!characterId || !input.assistantReply.trim()) return

    const prior = await this.interactionRepo.findOne({
      where: { character_id: characterId, conversation_id: input.conversationId, user_message_id: input.userMessageId }
    })
    if (prior) return

    const state = await this.characterStateService.getState(characterId)
    const applied = await this.characterStateService.applyInteraction(
      characterId,
      input.userMessage,
      input.assistantReply,
      state?.interaction_count ?? 0,
      input.occurredAt ?? new Date()
    )
    if (!applied) return

    await this.interactionRepo.save(this.interactionRepo.create({
      character_id: characterId,
      conversation_id: input.conversationId,
      user_message_id: input.userMessageId,
      assistant_message_id: input.assistantMessageId ?? null,
      delta: applied.evaluation.delta,
      signals: applied.evaluation.signals,
      reasons: applied.evaluation.reasons,
      occurred_at: input.occurredAt ?? new Date()
    }))
  }

  async rebuildCharacter(characterId: string): Promise<void> {
    const resolvedCharacterId = this.resolveCharacterId(characterId)
    if (!resolvedCharacterId) return

    await this.characterStateService.resetRelationship(resolvedCharacterId)
    await this.interactionRepo.delete({ character_id: resolvedCharacterId })

    const defaultCharacterId = this.characterService.getDefault()?.id
    const where = resolvedCharacterId === defaultCharacterId
      ? [{ character_id: resolvedCharacterId }, { character_id: IsNull() }]
      : [{ character_id: resolvedCharacterId }]
    const conversations = await this.conversationRepo.find({ where, order: { created_at: 'ASC' } })

    for (const conversation of conversations) {
      const messages = await this.messageRepo.find({
        where: { conversation_id: conversation.id },
        order: { created_at: 'ASC', id: 'ASC' }
      })
      for (let index = 0; index < messages.length; index += 1) {
        const userMessage = messages[index]
        if (userMessage.role !== 'user') continue
        const assistantMessage = messages.slice(index + 1).find((message) =>
          message.role === 'assistant' && (!userMessage.turn_id || message.turn_id === userMessage.turn_id)
        )
        if (!assistantMessage) continue
        await this.record({
          characterId: resolvedCharacterId,
          conversationId: conversation.id,
          userMessageId: userMessage.id,
          assistantMessageId: assistantMessage.id,
          userMessage: userMessage.content,
          assistantReply: assistantMessage.content,
          occurredAt: userMessage.created_at
        })
      }
    }
    this.logger.log('Rebuilt relationship interactions for character ' + resolvedCharacterId)
  }

  private resolveCharacterId(characterId?: string): string | null {
    if (characterId && this.characterService.findOne(characterId)) return characterId
    return this.characterService.getDefault()?.id ?? null
  }
}
