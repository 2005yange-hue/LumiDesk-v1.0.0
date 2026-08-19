import type { ExpressionProfile, ModelManifest } from '../live2d.types'

export function resolveExpressionProfile(manifest: ModelManifest, semanticName: string): ExpressionProfile | undefined {
  if (!(manifest.features?.expression ?? Boolean(manifest.expressionProfiles && Object.keys(manifest.expressionProfiles).length))) return undefined
  return manifest.expressionProfiles?.[semanticName]
}
