import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity('emotion_preferences')
export class EmotionPreference {
  @PrimaryGeneratedColumn()
  id: number

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, default: 'default' })
  user_id: string

  @Column({ type: 'boolean', default: true })
  enabled: boolean

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}