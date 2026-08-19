import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

export const NOTIFICATION_TYPES = ['event_reminder', 'wellbeing_checkin'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_STATUSES = ['unread', 'read', 'dismissed'] as const
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number]

/** AI 主动消息中心的持久化通知。 */
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number

  @Index()
  @Column({ type: 'varchar', length: 36, default: 'default' })
  user_id: string

  @Index()
  @Column({ type: 'varchar', length: 64 })
  character_id: string

  @Column({ type: 'varchar', length: 32 })
  type: NotificationType

  @Column({ type: 'text' })
  content: string

  @Index()
  @Column({ type: 'int', nullable: true })
  memory_event_id: number | null

  @Index()
  @Column({ type: 'int', nullable: true })
  source_memory_id: number | null

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'unread' })
  status: NotificationStatus

  @Column({ type: 'datetime', nullable: true })
  read_at: Date | null

  @Column({ type: 'datetime', nullable: true })
  system_notified_at: Date | null

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
