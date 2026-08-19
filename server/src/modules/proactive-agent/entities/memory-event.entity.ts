import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

export const MEMORY_EVENT_STATUSES = ['pending', 'sent', 'cancelled', 'expired'] as const
export type MemoryEventStatus = (typeof MEMORY_EVENT_STATUSES)[number]

/** 从 event 类型长期记忆中解析出的可提醒事项。 */
@Entity('memory_events')
export class MemoryEvent {
  @PrimaryGeneratedColumn()
  id: number

  @Index({ unique: true })
  @Column({ type: 'int' })
  memory_id: number

  @Index()
  @Column({ type: 'datetime' })
  event_time: Date

  @Index()
  @Column({ type: 'datetime' })
  remind_time: Date

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: MemoryEventStatus

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
