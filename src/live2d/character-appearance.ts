import type { Character, CharacterAppearance } from '@shared/types/character'

export type ResolvedCharacterAppearance = Omit<CharacterAppearance, 'modelId'> & {
  modelId: string | null
}

export function getCharacterAppearance(character: Pick<Character, 'appearance'> | null | undefined, defaultModelId: string | null): ResolvedCharacterAppearance {
  const appearance = character?.appearance || {}
  return {
    ...appearance,
    modelId: appearance.modelId || defaultModelId
  }
}



