import axios from 'axios'
import type { CharacterData, CreateCharacterRequest, UpdateCharacterRequest } from '@/types/character.types'

const API_BASE = '/api/character'

export async function getCharacters(): Promise<CharacterData[]> {
  const res = await axios.get<CharacterData[]>(API_BASE)
  return res.data
}

export async function getCharacter(id: string): Promise<CharacterData> {
  const res = await axios.get<CharacterData>(`${API_BASE}/${id}`)
  return res.data
}

export async function createCharacter(data: CreateCharacterRequest): Promise<CharacterData> {
  const res = await axios.post<CharacterData>(API_BASE, data)
  return res.data
}

export async function updateCharacter(
  id: string,
  data: UpdateCharacterRequest
): Promise<CharacterData> {
  const res = await axios.put<CharacterData>(`${API_BASE}/${id}`, data)
  return res.data
}

export async function deleteCharacter(id: string): Promise<void> {
  await axios.delete(`${API_BASE}/${id}`)
}
