import axios from 'axios'
import type { CharacterData, CreateCharacterRequest, UpdateCharacterRequest } from '@/types/character.types'

const API_BASE = '/api/character'

/** 统一响应包装 */
interface Wrapped<T> {
  success: boolean
  data: T
  message: string
  timestamp: string
}

export async function getCharacters(): Promise<CharacterData[]> {
  const res = await axios.get<Wrapped<CharacterData[]>>(API_BASE)
  return res.data.data
}

export async function getCharacter(id: string): Promise<CharacterData> {
  const res = await axios.get<Wrapped<CharacterData>>(`${API_BASE}/${id}`)
  return res.data.data
}

export async function createCharacter(data: CreateCharacterRequest): Promise<CharacterData> {
  const res = await axios.post<Wrapped<CharacterData>>(API_BASE, data)
  return res.data.data
}

export async function updateCharacter(
  id: string,
  data: UpdateCharacterRequest
): Promise<CharacterData> {
  const res = await axios.put<Wrapped<CharacterData>>(`${API_BASE}/${id}`, data)
  return res.data.data
}

export async function uploadCharacterAvatar(id: string, file: File): Promise<CharacterData> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await axios.post<Wrapped<CharacterData>>(`${API_BASE}/${id}/avatar`, formData)
  return res.data.data
}

export async function deleteCharacter(id: string): Promise<void> {
  await axios.delete(`${API_BASE}/${id}`)
}
