import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity('audio_providers')
export class AudioProvider {
  @PrimaryGeneratedColumn()
  id: number

  @Index()
  @Column({ type: 'varchar', length: 36, default: 'default' })
  user_id: string

  @Column({ type: 'varchar', length: 64 })
  name: string

  @Column({ type: 'varchar', length: 32, default: 'openai-compatible' })
  provider_type: string

  @Column({ type: 'varchar', length: 512 })
  base_url: string

  @Column({ type: 'varchar', length: 512 })
  api_key: string

  @Column({ type: 'varchar', length: 128 })
  tts_model: string

  @Column({ type: 'varchar', length: 128 })
  stt_model: string

  @Column({ type: 'varchar', length: 64, default: 'alloy' })
  default_voice: string

  @Column({ type: 'float', default: 1 })
  default_speed: number

  @Column({ type: 'boolean', default: true })
  enabled: boolean

  @Column({ type: 'boolean', default: false })
  is_default: boolean

  @Column({ type: 'int', default: 30000 })
  timeout: number

  @Column({ type: 'text', nullable: true })
  custom_headers: string | null

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
