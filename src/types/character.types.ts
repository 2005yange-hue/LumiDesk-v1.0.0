/** 角色数据 */
export interface CharacterData {
  id: string
  name: string
  age: number
  gender: string
  background: string
  personality: string
  speakingStyle: string
  likes: string[]
  dislikes: string[]
  relationshipLevel: number
  createdAt: string
  updatedAt: string
}

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
