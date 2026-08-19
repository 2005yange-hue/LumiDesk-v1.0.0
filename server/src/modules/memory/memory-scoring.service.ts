import { Injectable } from '@nestjs/common'
import { MemoryEntry } from './entities/memory-entry.entity'

/** 将记忆基础质量、使用频率与关系权重压缩为 0-1 的检索分数。 */
@Injectable()
export class MemoryScoringService {
  calculateScore(memory: Pick<MemoryEntry, 'type' | 'importance' | 'confidence' | 'usage_count'>): number {
    const usageFactor = 0.6 + Math.min(Math.max(memory.usage_count, 0), 10) / 25
    const relationshipWeight = memory.type === 'relationship' ? 1.12 : 1
    return this.clamp(memory.importance * memory.confidence * usageFactor * relationshipWeight)
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(1, Number(value.toFixed(4))))
  }
}
