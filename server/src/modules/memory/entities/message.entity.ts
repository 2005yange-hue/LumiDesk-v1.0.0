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

  @Column({ type: 'int', nullable: true, default: null })
  token_count: number | null

  @CreateDateColumn()
  created_at: Date

  @ManyToOne(() => Conversation)
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation
}
