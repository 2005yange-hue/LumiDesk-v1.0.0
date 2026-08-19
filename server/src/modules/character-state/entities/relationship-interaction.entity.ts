import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import type { RelationshipSignal } from '../relationship-engine.service'

/** 每轮已完成对话对关系状态产生的可重放影响。 */
@Entity('relationship_interactions')
@Index(['character_id', 'conversation_id', 'user_message_id'], { unique: true })
export class RelationshipInteraction {
  @PrimaryGeneratedColumn()
  id: number

  @Index()
  @Column({ type: 'varchar', length: 64 })
  character_id: string

  @Index()
  @Column({ type: 'varchar', length: 36 })
  conversation_id: string

  @Index()
  @Column({ type: 'varchar', length: 36 })
  user_message_id: string

  @Column({ type: 'varchar', length: 36, nullable: true })
  assistant_message_id: string | null

  @Column({ type: 'float' })
  delta: number

  @Column({ type: 'simple-json' })
  signals: RelationshipSignal[]

  @Column({ type: 'simple-json' })
  reasons: string[]

  @Index()
  @Column({ type: 'datetime' })
  occurred_at: Date

  @CreateDateColumn()
  created_at: Date
}
