import axios from 'axios'
import type { RelationshipProfile } from '@/types/relationship.types'

interface Wrapped<T> {
  success: boolean
  data: T
  message: string
  timestamp: string
}

export async function getRelationshipProfile(characterId: string): Promise<RelationshipProfile> {
  const response = await axios.get<Wrapped<RelationshipProfile>>(`/api/relationship/${characterId}`)
  return response.data.data
}
