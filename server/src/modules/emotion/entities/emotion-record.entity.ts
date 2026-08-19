import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

export const EMOTION_TYPES = ['happy', 'calm', 'anxious', 'sad', 'angry', 'tired'] as const
export type EmotionType = (typeof EMOTION_TYPES)[number]

export const EMOTION_SOURCES = ['rule', 'llm', 'manual'] as const
export type EmotionSource = (typeof EMOTION_SOURCES)[number]

@Entity('emotion_records')
@Index(['user_id', 'character_id', 'occurred_at'])
@Index(['user_message_id'], { unique: true })
export class EmotionRecord {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'varchar', length: 64, default: 'default' })
  user_id: string

  @Column({ type: 'varchar', length: 64 })
  character_id: string

  @Column({ type: 'varchar', length: 64, nullable: true })
  conversation_id: string | null

  @Column({ type: 'varchar', length: 64 })
  user_message_id: string

  @Column({ type: 'varchar', length: 16 })
  emotion: EmotionType

  @Column({ type: 'tinyint' })
  intensity: number

  @Column({ type: 'float' })
  confidence: number

  @Column({ type: 'varchar', length: 16 })
  source: EmotionSource

  @Column({ type: 'varchar', length: 240, nullable: true })
  reason: string | null

  @Column({ type: 'datetime' })
  occurred_at: Date

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}