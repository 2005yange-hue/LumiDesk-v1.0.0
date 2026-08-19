import type { Character } from '@shared/types/character'

/** 角色数据（重导出共享规范）。 */
export type CharacterData = Character

export interface CreateCharacterRequest {
  name: string
  age?: number
  gender?: string
  background?: string
  personality?: string
  speakingStyle?: string
  likes?: string[]
  dislikes?: string[]
  addressingRules?: CharacterData['addressingRules']
  openingMessage?: string
  appearance?: CharacterData['appearance']
}

export type UpdateCharacterRequest = Partial<CreateCharacterRequest>
