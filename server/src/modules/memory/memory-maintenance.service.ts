import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, IsNull, Repository } from 'typeorm'
import { VectorMemoryService } from '../vector-memory/vector-memory.service'
import { MemoryDeduplicationService } from './memory-deduplication.service'
import { MemoryEntry } from './entities/memory-entry.entity'
import { MemorySource } from './entities/memory-source.entity'
import { MemoryEvent } from '../proactive-agent/entities/memory-event.entity'
import { Notification } from '../proactive-agent/entities/notification.entity'
import { MemoryScoringService } from './memory-scoring.service'

const MAINTENANCE_BATCH_SIZE = 200

/** 每日维护记忆生命周期：衰减、归档、去重与失败向量重试。 */
@Injectable()
export class MemoryMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MemoryMaintenanceService.name)
  private timer: NodeJS.Timeout | null = null

  constructor(
    @InjectRepository(MemoryEntry)
    private readonly memoryRepo: Repository<MemoryEntry>,
    @InjectRepository(MemorySource)
    private readonly sourceRepo: Repository<MemorySource>,
    @InjectRepository(MemoryEvent)
    private readonly eventRepo: Repository<MemoryEvent>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly deduplication: MemoryDeduplicationService,
    private readonly scoring: MemoryScoringService,
    private readonly vectorMemory: VectorMemoryService
  ) {}

  onModuleInit(): void {
    this.scheduleNextRun()
  }

  onModuleDestroy(): void {
    if (this.timer) clearTimeout(this.timer)
  }

  async runMaintenance(): Promise<void> {
    try {
      await this.decayStaleMemories()
      await this.archiveLowValueMemories()
      await this.deduplicateMemories()
      await this.retryFailedVectors()
      this.logger.log('Memory maintenance completed')
    } catch (error) {
      this.logger.error('Memory maintenance failed:', error)
    }
  }

  private scheduleNextRun(): void {
    const now = new Date()
    const next = new Date(now)
    next.setDate(next.getDate() + 1)
    next.setHours(0, 0, 0, 0)
    const delay = Math.max(next.getTime() - now.getTime(), 1_000)

    this.timer = setTimeout(() => {
      void this.runMaintenance().finally(() => this.scheduleNextRun())
    }, delay)
    this.logger.log(`Next memory maintenance scheduled for ${next.toISOString()}`)
  }

  private async decayStaleMemories(): Promise<void> {
    const memories = await this.memoryRepo.find({
      where: { status: 'active' },
      take: MAINTENANCE_BATCH_SIZE
    })
    const now = new Date()

    for (const memory of memories) {
      const reference = memory.last_decay_at ?? memory.last_used_at ?? memory.created_at
      const days = Math.floor((now.getTime() - reference.getTime()) / 86_400_000)
      const factor = days >= 90 ? 0.8 : days >= 30 ? 0.95 : 1
      if (factor === 1) continue

      memory.importance = Math.max(0.05, Number((memory.importance * factor).toFixed(4)))
      memory.last_decay_at = now
      memory.memory_score = this.scoring.calculateScore(memory)
      await this.memoryRepo.save(memory)
    }
  }

  private async archiveLowValueMemories(): Promise<void> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 180)
    const memories = await this.memoryRepo
      .createQueryBuilder('memory')
      .where('memory.status = :status', { status: 'active' })
      .andWhere('memory.memory_score < :score', { score: 0.08 })
      .andWhere('(memory.last_used_at IS NULL OR memory.last_used_at < :cutoff)', { cutoff })
      .take(MAINTENANCE_BATCH_SIZE)
      .getMany()

    for (const memory of memories) {
      memory.status = 'archived'
      memory.memory_score = this.scoring.calculateScore(memory)
      await this.memoryRepo.save(memory)
      await this.syncVectorMetadata(memory)
    }
  }

  private async deduplicateMemories(): Promise<void> {
    const memories = await this.memoryRepo.find({
      where: { status: 'active' },
      order: { updated_at: 'ASC' },
      take: MAINTENANCE_BATCH_SIZE
    })

    for (const memory of memories) {
      const decision = await this.deduplication.inspect(
        {
          type: memory.type,
          content: memory.content,
          importance: memory.importance,
          confidence: memory.confidence
        },
        memory.user_id,
        memory.character_id,
        memory.id
      )
      if (decision.action !== 'merge') continue

      const target = decision.target
      target.content = this.deduplication.mergeContent(target.content, memory.content)
      target.importance = Math.min(1, Math.max(target.importance, memory.importance) + 0.05)
      target.confidence = Math.max(target.confidence, memory.confidence)
      target.memory_score = this.scoring.calculateScore(target)
      await this.memoryRepo.save(target)

      memory.status = 'superseded'
      memory.replacement_memory_id = target.id
      await this.memoryRepo.save(memory)
      await Promise.all([this.syncVectorMetadata(target, true), this.syncVectorMetadata(memory)])
    }
  }

  private async retryFailedVectors(): Promise<void> {
    const pendingDeletion = await this.memoryRepo.find({
      where: { deletion_pending: true },
      take: MAINTENANCE_BATCH_SIZE
    })

    for (const memory of pendingDeletion) {
      try {
        if (memory.vector_id) await this.vectorMemory.deleteMemory(memory.vector_id)
        const events = await this.eventRepo.find({ where: { memory_id: memory.id } })
        const eventIds = events.map((event) => event.id)
        await this.notificationRepo.delete(eventIds.length > 0
          ? [{ source_memory_id: memory.id }, { memory_event_id: In(eventIds) }]
          : [{ source_memory_id: memory.id }]
        )
        if (eventIds.length > 0) await this.eventRepo.delete({ id: In(eventIds) })
        await this.sourceRepo.delete({ memory_id: memory.id })
        await this.memoryRepo.delete(memory.id)
      } catch (error) {
        memory.vector_sync_status = 'failed'
        memory.vector_sync_error = error instanceof Error ? error.message : String(error)
        await this.memoryRepo.save(memory)
      }
    }

    const memories = await this.memoryRepo.find({
      where: [
        { vector_sync_status: 'failed', deletion_pending: false },
        { vector_sync_status: 'pending', vector_id: IsNull(), deletion_pending: false }
      ],
      take: MAINTENANCE_BATCH_SIZE
    })

    for (const memory of memories) {
      try {
        const vectorId = memory.vector_id || String(memory.id)
        await this.vectorMemory.updateMemory(
          vectorId,
          memory.user_id,
          memory.content,
          this.vectorMetadata(memory),
          true,
          Boolean(memory.vector_id)
        )
        memory.vector_id = vectorId
        memory.vector_sync_status = 'synced'
        memory.vector_sync_error = null
        await this.memoryRepo.save(memory)
      } catch (error) {
        memory.vector_sync_status = 'failed'
        memory.vector_sync_error = error instanceof Error ? error.message : String(error)
        await this.memoryRepo.save(memory)
      }
    }
  }

  private async syncVectorMetadata(memory: MemoryEntry, contentChanged = false): Promise<void> {
    if (!memory.vector_id) return
    try {
      await this.vectorMemory.updateMemory(
        memory.vector_id,
        memory.user_id,
        memory.content,
        this.vectorMetadata(memory),
        contentChanged,
        true
      )
    } catch (error) {
      memory.vector_sync_status = 'failed'
      memory.vector_sync_error = error instanceof Error ? error.message : String(error)
      await this.memoryRepo.save(memory)
    }
  }

  private vectorMetadata(memory: MemoryEntry): Record<string, unknown> {
    return {
      type: memory.type,
      importance: memory.importance,
      confidence: memory.confidence,
      memoryScore: memory.memory_score,
      status: memory.status,
      ...(memory.character_id ? { characterId: memory.character_id } : {})
    }
  }
}
