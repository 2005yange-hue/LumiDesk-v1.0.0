import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { VectorMemoryService } from '../vector-memory/vector-memory.service'
import { MemoryEntry, MemoryType } from './entities/memory-entry.entity'
import type { MemoryEntryData } from './memory-extractor.service'

export type MemoryIntelligenceDecision =
  | { action: 'create' }
  | { action: 'merge'; target: MemoryEntry; similarity: number }
  | { action: 'supersede'; target: MemoryEntry }

const DEDUPLICATION_THRESHOLD = 0.85

/** 新记忆进入数据库前的去重和冲突判断。 */
@Injectable()
export class MemoryDeduplicationService {
  constructor(
    @InjectRepository(MemoryEntry)
    private readonly memoryRepo: Repository<MemoryEntry>,
    private readonly vectorMemory: VectorMemoryService
  ) {}

  async inspect(
    entry: MemoryEntryData,
    userId: string,
    characterId: string | null,
    excludeMemoryId?: number
  ): Promise<MemoryIntelligenceDecision> {
    const candidates = await this.loadCandidates(entry.type, userId, characterId, excludeMemoryId)
    if (candidates.length === 0) return { action: 'create' }

    const conflictTarget = this.findConflict(entry, candidates)
    if (conflictTarget) return { action: 'supersede', target: conflictTarget }

    const vectorSimilarity = await this.findVectorSimilarity(entry, userId, characterId, candidates)
    if (vectorSimilarity && vectorSimilarity.similarity >= DEDUPLICATION_THRESHOLD) {
      return { action: 'merge', ...vectorSimilarity }
    }

    const textMatch = candidates
      .map((candidate) => ({ candidate, similarity: this.textSimilarity(entry.content, candidate.content) }))
      .sort((left, right) => right.similarity - left.similarity)[0]
    if (textMatch && textMatch.similarity >= DEDUPLICATION_THRESHOLD) {
      return { action: 'merge', target: textMatch.candidate, similarity: textMatch.similarity }
    }

    return { action: 'create' }
  }

  mergeContent(oldContent: string, newContent: string): string {
    const normalizedOld = this.normalize(oldContent)
    const normalizedNew = this.normalize(newContent)
    if (normalizedOld.includes(normalizedNew)) return oldContent
    if (normalizedNew.includes(normalizedOld)) return newContent

    const preferencePrefix = '用户喜欢'
    if (oldContent.startsWith(preferencePrefix) && newContent.startsWith(preferencePrefix)) {
      const oldPreference = oldContent.slice(preferencePrefix.length).replace(/^[\s，。；;]+|[\s，。；;]+$/g, '')
      const newPreference = newContent.slice(preferencePrefix.length).replace(/^[\s，。；;]+|[\s，。；;]+$/g, '')
      return `${preferencePrefix}${oldPreference}，尤其是${newPreference}`
    }

    return `${oldContent.replace(/[。；;\s]+$/, '')}；${newContent}`
  }

  private async loadCandidates(
    type: MemoryType,
    userId: string,
    characterId: string | null,
    excludeMemoryId?: number
  ): Promise<MemoryEntry[]> {
    const query = this.memoryRepo
      .createQueryBuilder('memory')
      .where('memory.user_id = :userId', { userId })
      .andWhere('memory.status = :status', { status: 'active' })
      .andWhere('(memory.type = :type OR (:type = :personalityType AND memory.type = :legacyType))', {
        type,
        personalityType: 'personality',
        legacyType: 'personal'
      })

    if (characterId) {
      query.andWhere('(memory.character_id = :characterId OR memory.character_id IS NULL)', { characterId })
    }
    if (excludeMemoryId) query.andWhere('memory.id != :excludeMemoryId', { excludeMemoryId })

    return query.orderBy('memory.updated_at', 'DESC').take(50).getMany()
  }

  private async findVectorSimilarity(
    entry: MemoryEntryData,
    userId: string,
    characterId: string | null,
    candidates: MemoryEntry[]
  ): Promise<{ target: MemoryEntry; similarity: number } | null> {
    const results = await this.vectorMemory.search(entry.content, userId, 10, characterId ?? undefined)
    const candidateById = new Map(candidates.map((candidate) => [String(candidate.id), candidate]))
    const best = results
      .map((result) => ({ target: candidateById.get(result.memoryId), similarity: result.score }))
      .filter((result): result is { target: MemoryEntry; similarity: number } => Boolean(result.target))
      .sort((left, right) => right.similarity - left.similarity)[0]

    return best ?? null
  }

  private findConflict(entry: MemoryEntryData, candidates: MemoryEntry[]): MemoryEntry | null {
    if (!this.hasReplacementSignal(entry.content)) return null
    if (!['preference', 'fact', 'personality'].includes(entry.type)) return null

    const relation = this.extractRelation(entry.content)
    const subject = this.extractSubject(entry.content)
    if (!relation || !subject) return null

    return candidates.find((candidate) => {
      const candidateRelation = this.extractRelation(candidate.content)
      return candidateRelation === relation &&
        this.extractSubject(candidate.content) === subject &&
        this.normalize(candidate.content) !== this.normalize(entry.content)
    }) ?? null
  }

  private hasReplacementSignal(content: string): boolean {
    return /(其实更|现在更|不再|不喜欢|改成|改为|更喜欢|以前.*现在)/.test(content)
  }

  private extractRelation(content: string): string | null {
    if (/(喜欢|偏好|爱喝)/.test(content)) return 'preference'
    if (/(叫|名字是|改名)/.test(content)) return 'identity'
    if (/(职业|专业|从事)/.test(content)) return 'profile'
    return null
  }

  private extractSubject(content: string): string | null {
    const relationMatch = /(喜欢|偏好|爱喝|叫|名字是|改名|职业|专业|从事)/.exec(content)
    if (!relationMatch?.index) return null
    const subject = content
      .slice(0, relationMatch.index)
      .replace(/(其实|现在|更|不再|不)$/g, '')
      .replace(/[\s，。；;、]/g, '')
    return subject || null
  }

  private textSimilarity(left: string, right: string): number {
    const leftTokens = new Set(this.normalize(left).split(''))
    const rightTokens = new Set(this.normalize(right).split(''))
    if (leftTokens.size === 0 || rightTokens.size === 0) return 0
    const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length
    return (2 * overlap) / (leftTokens.size + rightTokens.size)
  }

  private normalize(value: string): string {
    return value.toLowerCase().replace(/[\s，。；;、,.!！?？]/g, '')
  }
}
