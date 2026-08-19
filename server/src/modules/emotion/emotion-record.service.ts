import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Between, Repository } from 'typeorm'
import { CharacterService } from '../character/character.service'
import { UpdateEmotionRecordDto } from './dto/update-emotion-record.dto'
import { EmotionRecord, EmotionSource, EmotionType } from './entities/emotion-record.entity'

const DEFAULT_USER_ID = 'default'
const RETENTION_DAYS = 30
const SUMMARY_DAYS = 7

export interface EmotionRecordInput {
  characterId: string
  conversationId?: string
  userMessageId: string
  emotion: EmotionType
  intensity: number
  confidence: number
  source: Exclude<EmotionSource, 'manual'>
  reason: string
  occurredAt?: Date
}

export interface EmotionSummary {
  primaryEmotion: EmotionType | null
  averageIntensity: number
  recentCount: number
  distribution: Record<EmotionType, number>
}

@Injectable()
export class EmotionRecordService {
  constructor(
    @InjectRepository(EmotionRecord)
    private readonly recordRepo: Repository<EmotionRecord>,
    private readonly characterService: CharacterService
  ) {}

  async list(characterId: string, from?: Date, to?: Date, page = 1, limit = 50): Promise<{ records: EmotionRecord[]; total: number }> {
    this.requireCharacter(characterId)
    const rangeStart = from ?? this.daysAgo(RETENTION_DAYS)
    const rangeEnd = to ?? new Date()
    const [records, total] = await this.recordRepo.findAndCount({
      where: { user_id: DEFAULT_USER_ID, character_id: characterId, occurred_at: Between(rangeStart, rangeEnd) },
      order: { occurred_at: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit
    })
    return { records, total }
  }

  async getSummary(characterId: string): Promise<EmotionSummary> {
    this.requireCharacter(characterId)
    const records = await this.recordRepo.find({
      where: { user_id: DEFAULT_USER_ID, character_id: characterId, occurred_at: Between(this.daysAgo(SUMMARY_DAYS), new Date()) },
      order: { occurred_at: 'DESC', id: 'DESC' }
    })
    const distribution: Record<EmotionType, number> = { happy: 0, calm: 0, anxious: 0, sad: 0, angry: 0, tired: 0 }
    let totalIntensity = 0
    for (const record of records) {
      distribution[record.emotion] += 1
      totalIntensity += record.intensity
    }
    const primaryEmotion = (Object.entries(distribution) as Array<[EmotionType, number]>)
      .sort((left, right) => right[1] - left[1])[0]?.[1]
      ? (Object.entries(distribution) as Array<[EmotionType, number]>).sort((left, right) => right[1] - left[1])[0][0]
      : null
    return {
      primaryEmotion,
      averageIntensity: records.length ? Math.round((totalIntensity / records.length) * 10) / 10 : 0,
      recentCount: records.length,
      distribution
    }
  }

  async update(id: number, dto: UpdateEmotionRecordDto): Promise<EmotionRecord> {
    const record = await this.getOwnedRecord(id)
    record.emotion = dto.emotion
    record.intensity = dto.intensity
    record.reason = dto.reason?.trim() || null
    record.source = 'manual'
    return this.recordRepo.save(record)
  }

  async remove(id: number): Promise<void> {
    const record = await this.getOwnedRecord(id)
    await this.recordRepo.remove(record)
  }

  async clearForCharacter(characterId: string): Promise<void> {
    this.requireCharacter(characterId)
    await this.recordRepo.delete({ user_id: DEFAULT_USER_ID, character_id: characterId })
  }

  async upsertAutomatic(input: EmotionRecordInput): Promise<EmotionRecord | null> {
    const existing = await this.recordRepo.findOne({ where: { user_message_id: input.userMessageId } })
    if (existing?.source === 'manual') return existing
    const record = existing ?? this.recordRepo.create({ user_id: DEFAULT_USER_ID, user_message_id: input.userMessageId })
    record.character_id = input.characterId
    record.conversation_id = input.conversationId || null
    record.emotion = input.emotion
    record.intensity = input.intensity
    record.confidence = Math.max(0, Math.min(1, input.confidence))
    record.source = input.source
    record.reason = input.reason.slice(0, 240)
    record.occurred_at = input.occurredAt ?? new Date()
    return this.recordRepo.save(record)
  }

  async removeForMessages(conversationId: string, userMessageIds: string[]): Promise<void> {
    if (!userMessageIds.length) return
    const records = await this.recordRepo.createQueryBuilder('record')
      .where('record.conversation_id = :conversationId', { conversationId })
      .andWhere('record.user_message_id IN (:...userMessageIds)', { userMessageIds })
      .getMany()
    if (records.length) await this.recordRepo.remove(records)
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.recordRepo.createQueryBuilder()
      .delete()
      .where('occurred_at < :cutoff', { cutoff: this.daysAgo(RETENTION_DAYS) })
      .execute()
    return result.affected ?? 0
  }

  private async getOwnedRecord(id: number): Promise<EmotionRecord> {
    const record = await this.recordRepo.findOne({ where: { id, user_id: DEFAULT_USER_ID } })
    if (!record) throw new NotFoundException('情绪记录不存在')
    return record
  }

  private requireCharacter(characterId: string): void {
    if (!this.characterService.findOne(characterId)) throw new NotFoundException('角色不存在')
  }

  private daysAgo(days: number): Date {
    return new Date(Date.now() - days * 86_400_000)
  }
}