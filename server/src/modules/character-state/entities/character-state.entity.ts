import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

export const CHARACTER_MOODS = ['happy', 'calm', 'concerned', 'tired'] as const
export type CharacterMood = (typeof CHARACTER_MOODS)[number]

export const CHARACTER_RELATIONSHIP_LEVELS = ['stranger', 'familiar', 'friend', 'intimate', 'special'] as const
export type CharacterRelationshipLevel = (typeof CHARACTER_RELATIONSHIP_LEVELS)[number]

export const CHARACTER_RELATIONSHIP_LABELS: Record<CharacterRelationshipLevel, string> = {
  stranger: '陌生',
  familiar: '熟悉',
  friend: '朋友',
  intimate: '亲密',
  special: '特殊关系'
}

export function getRelationshipLevelByAffinity(affinity: number): CharacterRelationshipLevel {
  if (affinity < 20) return 'stranger'
  if (affinity < 40) return 'familiar'
  if (affinity < 70) return 'friend'
  if (affinity < 90) return 'intimate'
  return 'special'
}

@Entity('character_state')
export class CharacterState {
  @PrimaryGeneratedColumn()
  id: number

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  character_id: string

  @Column({ type: 'varchar', length: 16, default: 'calm' })
  mood: CharacterMood

  @Column({ type: 'int', default: 100 })
  energy: number

  @Column({ type: 'float', default: 10 })
  affinity: number

  @Column({ type: 'varchar', length: 16, default: 'stranger' })
  relationship_level: CharacterRelationshipLevel

  @Column({ type: 'int', default: 50 })
  initiative_level: number

  @Column({ type: 'int', default: 0 })
  interaction_count: number

  @Column({ type: 'int', default: 0 })
  shared_experience_count: number

  @Column({ type: 'datetime', nullable: true })
  last_interaction_at: Date | null

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
