import axios from 'axios'
import type { MemoryEntry, UpdateMemoryRequest } from '@/types/memory.types'

const API_BASE = '/api/memory'

interface Wrapped<T> {
  success: boolean
  data: T
  message: string
  timestamp: string
}

export async function getMemories(characterId: string): Promise<MemoryEntry[]> {
  const response = await axios.get<Wrapped<MemoryEntry[]>>(`${API_BASE}/${characterId}`)
  return response.data.data
}

export async function updateMemory(
  id: number,
  data: UpdateMemoryRequest
): Promise<MemoryEntry> {
  const response = await axios.patch<Wrapped<MemoryEntry>>(`${API_BASE}/${id}`, data)
  return response.data.data
}

export async function deleteMemory(id: number): Promise<void> {
  await axios.delete(`${API_BASE}/${id}`)
}
