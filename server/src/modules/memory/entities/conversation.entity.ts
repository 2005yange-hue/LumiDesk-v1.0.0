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

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
