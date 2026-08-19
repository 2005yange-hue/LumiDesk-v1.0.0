/**
 * Character 角色接口 — 前后端共享规范定义
 * 这是唯一的规范来源（single source of truth）。
 */
export type CharacterRelationshipLevel = 'stranger' | 'familiar' | 'friend' | 'intimate' | 'special'

export type CharacterAddressingRules = Partial<Record<CharacterRelationshipLevel, string>>

export interface CharacterAppearance {
  modelId?: string
  expressionSetId?: string
  motionSetId?: string
  backgroundId?: string
  themeId?: string
  presentationStyleId?: string
}

export interface Character {
  id: string
  name: string
  age: number
  gender: string
  background: string
  personality: string
  speakingStyle: string
  likes: string[]
  dislikes: string[]
  addressingRules: CharacterAddressingRules
  avatarUrl?: string
  openingMessage?: string
  appearance?: CharacterAppearance
  createdAt: string
  updatedAt: string
}

