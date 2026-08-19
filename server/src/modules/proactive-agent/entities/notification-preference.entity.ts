import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/** 全局默认配置使用 character_id = NULL；角色记录仅保存覆盖字段。 */
@Entity('notification_preferences')
@Index(['user_id', 'character_id'], { unique: true })
export class NotificationPreference {
  @PrimaryGeneratedColumn()
  id: number

  @Index()
  @Column({ type: 'varchar', length: 36, default: 'default' })
  user_id: string

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  character_id: string | null

  @Column({ type: 'boolean', nullable: true })
  enabled: boolean | null

  @Column({ type: 'boolean', nullable: true })
  system_enabled: boolean | null

  @Column({ type: 'boolean', nullable: true })
  event_reminder_enabled: boolean | null

  @Column({ type: 'boolean', nullable: true })
  wellbeing_checkin_enabled: boolean | null

  @Column({ type: 'varchar', length: 5, nullable: true })
  quiet_start: string | null

  @Column({ type: 'varchar', length: 5, nullable: true })
  quiet_end: string | null

  @Column({ type: 'int', nullable: true })
  daily_limit: number | null

  @Column({ type: 'int', nullable: true })
  cooldown_minutes: number | null

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
