import axios from 'axios'
import type { CharacterState } from '@/types/character-state.types'

interface Wrapped<T> {
  success: boolean
  data: T
  message: string
  timestamp: string
}

/** 获取角色运行态；服务端会在首次读取时自动初始化。 */
export async function getCharacterState(characterId: string): Promise<CharacterState> {
  const res = await axios.get<Wrapped<CharacterState>>(`/api/character-state/${characterId}`)
  return res.data.data
}

/** 设置角色的主动互动等级（0-100）。 */
export async function updateInitiativeLevel(
  characterId: string,
  initiativeLevel: number
): Promise<CharacterState> {
  const res = await axios.patch<Wrapped<CharacterState>>(
    `/api/character-state/${characterId}/initiative`,
    { initiative_level: initiativeLevel }
  )
  return res.data.data
}
