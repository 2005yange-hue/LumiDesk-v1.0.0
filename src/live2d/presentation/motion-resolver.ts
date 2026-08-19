import type { ModelManifest, MotionQueueItem } from '../live2d.types'

export function resolveMotionGroups(manifest: ModelManifest, semanticName: string): string[] {
  const motionEnabled = manifest.features?.motion ?? manifest.capabilities.motions.length > 0
  if (!motionEnabled && semanticName !== 'idle') return manifest.semanticActions.idle ?? []
  const groups = manifest.semanticActions[semanticName]
  if (groups?.length) return groups
  return manifest.semanticActions.idle ?? []
}
