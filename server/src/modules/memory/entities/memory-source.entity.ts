import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** 自动记忆的可追溯来源；同一去重记忆可以关联多个会话消息。 */
@Entity('memory_sources')
@Index(['memory_id', 'conversation_id', 'user_message_id'], { unique: true })
export class MemorySource {
  @PrimaryGeneratedColumn()
  id: number

  @Index()
  @Column({ type: 'int' })
  memory_id: number

  @Index()
  @Column({ type: 'varchar', length: 36 })
  conversation_id: string

  @Index()
  @Column({ type: 'varchar', length: 36 })
  user_message_id: string

  @Column({ type: 'varchar', length: 36, nullable: true })
  assistant_message_id: string | null

  @CreateDateColumn()
  created_at: Date
}
