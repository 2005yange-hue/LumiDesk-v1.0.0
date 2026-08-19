import type { CharacterMood } from '@/types/character-state.types'
import type { ModelManifest, SemanticAction } from './live2d.types'

const MOOD_ACTIONS: Record<CharacterMood, SemanticAction> = {
  happy: 'positive',
  calm: 'calm',
  concerned: 'concerned',
  tired: 'tired'
}

export function resolveCharacterPresentation(mood: CharacterMood | null | undefined): SemanticAction {
  return mood ? MOOD_ACTIONS[mood] : 'idle'
}

export function resolveSemanticMotion(manifest: ModelManifest, action: SemanticAction): string[] {
  const actions = manifest.semanticActions[action]
  if (actions?.length) return actions
  return manifest.semanticActions.idle || []
}
