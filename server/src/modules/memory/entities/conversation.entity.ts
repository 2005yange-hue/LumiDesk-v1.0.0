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

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
