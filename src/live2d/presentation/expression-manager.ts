import type { ExpressionLayerState, PresentationSnapshot, PresentationSource } from '../live2d.types'

function cloneLayer(layer: ExpressionLayerState): ExpressionLayerState {
  return { ...layer }
}

export class ExpressionManager {
  private readonly layers = new Map<PresentationSource, ExpressionLayerState>()

  set(layer: ExpressionLayerState): boolean {
    const previous = this.layers.get(layer.source)
    const changed = !previous || previous.name !== layer.name || previous.priority !== layer.priority || previous.intensity !== layer.intensity || previous.curve !== layer.curve
    this.layers.set(layer.source, cloneLayer(layer))
    return changed
  }

  replace(source: PresentationSource, layer: ExpressionLayerState): boolean {
    this.clear(source)
    return this.set(layer)
  }

  clear(source: PresentationSource): boolean {
    return this.layers.delete(source)
  }

  clearAll(): void {
    this.layers.clear()
  }

  expire(now = Date.now()): PresentationSource[] {
    const expired: PresentationSource[] = []
    for (const [source, layer] of this.layers) {
      if (layer.duration !== undefined && layer.startedAt !== undefined && now - layer.startedAt >= layer.duration) {
        this.layers.delete(source)
        expired.push(source)
      }
    }
    return expired
  }

  getLayers(): ExpressionLayerState[] {
    return [...this.layers.values()].sort((left, right) => left.priority - right.priority)
  }

  getActiveLayer(): ExpressionLayerState | undefined {
    return this.getLayers().at(-1)
  }

  snapshot(): ExpressionLayerState[] {
    return this.getLayers().map(cloneLayer)
  }

  restore(snapshot: PresentationSnapshot): void {
    this.clearAll()
    for (const layer of snapshot.expressionLayers) this.set(layer)
  }
}
