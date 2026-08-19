import type { ExpressionLayerState, ModelManifest, MotionQueueItem, PresentationDebugSnapshot, PresentationIntent, PresentationSnapshot, PresentationSource, SystemParameterSource } from '../live2d.types'
import type { MotionRunner } from './motion-manager'

export interface PresentationDriver extends MotionRunner {
  apply(intent: PresentationIntent): Promise<void>
  applyExpressionLayers(layers: ExpressionLayerState[]): Promise<Record<string, number>>
  clearExpressionLayers(): void
  setSystemParameterLayer(source: SystemParameterSource, parameters: Record<string, number>): void
  clearSystemParameterLayer(source: SystemParameterSource): void
  restore(snapshot: PresentationSnapshot): void
  getManifest(): ModelManifest | null
  getFinalParameters(): Record<string, number>
  getDebugSnapshot(): PresentationDebugSnapshot | null
}

