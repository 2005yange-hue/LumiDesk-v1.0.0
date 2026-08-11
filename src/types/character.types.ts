import type { Character } from '@shared/types/character'

/** 角色数据（重导出共享规范） */
export type CharacterData = Character

/** 创建角色请求 */
export interface CreateCharacterRequest {
  name: string
  age?: number
  gender?: string
  background?: string
  personality?: string
  speakingStyle?: string
  likes?: string[]
  dislikes?: string[]
}

/** 更新角色请求 */
export type UpdateCharacterRequest = Partial<CreateCharacterRequest>
