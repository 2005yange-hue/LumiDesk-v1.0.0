import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import { CharacterRelationshipLevel } from './character-state.entity'

@Entity('relationship_history')
export class RelationshipHistory {
  @PrimaryGeneratedColumn()
  id: number

  @Index()
  @Column({ type: 'varchar', length: 64 })
  character_id: string

  @Column({ type: 'varchar', length: 16 })
  old_level: CharacterRelationshipLevel

  @Column({ type: 'varchar', length: 16 })
  new_level: CharacterRelationshipLevel

  @Column({ type: 'text' })
  reason: string

  @CreateDateColumn()
  created_at: Date
}
