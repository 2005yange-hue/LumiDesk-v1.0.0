import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('relationship_milestones')
@Index(['character_id', 'code'], { unique: true })
export class RelationshipMilestone {
  @PrimaryGeneratedColumn()
  id: number

  @Index()
  @Column({ type: 'varchar', length: 64 })
  character_id: string

  @Column({ type: 'varchar', length: 48 })
  code: string

  @Column({ type: 'varchar', length: 80 })
  title: string

  @Column({ type: 'varchar', length: 255 })
  description: string

  @CreateDateColumn()
  achieved_at: Date
}
