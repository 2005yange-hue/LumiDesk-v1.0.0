import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

@Entity('memory_entries')
export class MemoryEntry {
  @PrimaryGeneratedColumn()
  id: number

  @Index()
  @Column({ type: 'varchar', length: 36, default: 'default' })
  user_id: string

  @Column({ type: 'varchar', length: 32 })
  type: string

  @Column({ type: 'text' })
  content: string

  @Column({ type: 'float', default: 0.5 })
  importance: number

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
