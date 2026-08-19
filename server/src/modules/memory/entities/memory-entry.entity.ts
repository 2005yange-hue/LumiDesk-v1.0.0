import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

export const MEMORY_TYPES = ['preference', 'personality', 'event', 'relationship', 'fact'] as const
export type MemoryType = (typeof MEMORY_TYPES)[number]

export const VECTOR_SYNC_STATUSES = ['pending', 'synced', 'failed'] as const
export type VectorSyncStatus = (typeof VECTOR_SYNC_STATUSES)[number]

export const MEMORY_STATUSES = ['active', 'superseded', 'archived'] as const
export type MemoryStatus = (typeof MEMORY_STATUSES)[number]

@Entity('memory_entries')
export class MemoryEntry {
  @PrimaryGeneratedColumn()
  id: number

  @Index()
  @Column({ type: 'varchar', length: 36, default: 'default' })
  user_id: string

  /** 角色 ID 来自 JSON 角色资料；旧记录为空以保持向后兼容。 */
  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  character_id: string | null

  /** legacy 表示 v0.16 前的不可追溯记录；automatic 记录可随会话重建。 */
  @Column({ type: 'varchar', length: 16, default: 'legacy' })
  origin: 'legacy' | 'automatic'

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  source_conversation_id: string | null

  @Column({ type: 'varchar', length: 36, nullable: true })
  source_message_id: string | null

  @Column({ type: 'varchar', length: 36, nullable: true })
  source_assistant_message_id: string | null

  /** ChromaDB 中的向量 ID，用于 MySQL ↔ Chroma 关联 */
  @Column({ type: 'varchar', length: 64, nullable: true })
  vector_id: string | null

  /** MySQL 记录与 Chroma 向量的最近同步状态。 */
  @Column({ type: 'varchar', length: 16, default: 'pending' })
  vector_sync_status: VectorSyncStatus

  /** 最近一次向量同步失败原因。 */
  @Column({ type: 'text', nullable: true })
  vector_sync_error: string | null

  /** 会话重建删除向量失败时保留记录，供维护任务继续删除。 */
  @Column({ type: 'boolean', default: false })
  deletion_pending: boolean

  /** 记忆生命周期状态：active 可被注入上下文，其他状态仅保留历史。 */
  @Index()
  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: MemoryStatus

  /** 当前记忆替代的旧记忆 ID，仅 superseded 记录使用。 */
  @Column({ type: 'int', nullable: true })
  replacement_memory_id: number | null

  @Column({ type: 'varchar', length: 32 })
  type: MemoryType

  @Column({ type: 'text' })
  content: string

  @Column({ type: 'float', default: 0.5 })
  importance: number

  /** 提取器对该记忆准确性的判断，范围 0-1。 */
  @Column({ type: 'float', default: 0.5 })
  confidence: number

  /** 记忆被注入上下文的累计次数。 */
  @Column({ type: 'int', default: 0 })
  usage_count: number

  /** 综合重要度、置信度、使用频率与关系权重后的检索分数。 */
  @Column({ type: 'float', default: 0.5 })
  memory_score: number

  /** 最近一次被注入对话上下文的时间，用于后续衰减与治理。 */
  @Column({ type: 'datetime', nullable: true })
  last_used_at: Date | null

  /** 最近一次衰减处理时间，避免维护任务重复折损。 */
  @Column({ type: 'datetime', nullable: true })
  last_decay_at: Date | null

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
