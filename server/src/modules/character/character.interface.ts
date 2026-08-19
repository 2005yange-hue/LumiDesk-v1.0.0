/**
 * Character 接口 — 与 shared/types/character.ts 保持一致。
 * 此处为本项目本地定义，受 NestJS tsc rootDir 限制无法直接 import shared/。
 */
export type CharacterAddressingRules = Partial<Record<'stranger' | 'familiar' | 'friend' | 'intimate' | 'special', string>>

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

