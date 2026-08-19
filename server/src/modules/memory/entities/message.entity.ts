import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { Conversation } from './conversation.entity'

@Entity('messages')
export class Message {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string

  @Column({ type: 'varchar', length: 36 })
  conversation_id: string

  @Column({ type: 'varchar', length: 16 })
  role: 'user' | 'assistant'

  @Column({ type: 'text' })
  content: string

  /** 同一轮用户消息与助手回复共享的稳定标识。旧消息为空以保持兼容。 */
  @Column({ type: 'varchar', length: 36, nullable: true })
  turn_id: string | null

  @Column({ type: 'int', nullable: true, default: null })
  token_count: number | null

  @CreateDateColumn()
  created_at: Date

  @ManyToOne(() => Conversation)
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation
}
