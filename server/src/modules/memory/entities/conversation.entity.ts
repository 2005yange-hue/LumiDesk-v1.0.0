import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('conversations')
export class Conversation {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string

  @Column({ type: 'varchar', length: 36, default: 'default' })
  user_id: string

  @Column({ type: 'varchar', length: 64, nullable: true })
  character_id: string

  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string

  /** 消息总数（缓存字段，通过 increment 累加维护，避免 COUNT 查询） */
  @Column({ type: 'int', default: 0 })
  message_count: number

  /** 已压缩的历史对话摘要；原始消息仍保留在 messages 表中。 */
  @Column({ type: 'text', nullable: true })
  summary: string | null

  /** 已进入 summary 的消息数，用作 messages 表的稳定偏移量。 */
  @Column({ type: 'int', default: 0 })
  summary_message_count: number

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
