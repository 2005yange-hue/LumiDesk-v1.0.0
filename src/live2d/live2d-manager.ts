import { PixiLive2DRendererAdapter } from './pixi-live2d-renderer-adapter'
import { resolveExpressionProfile } from './presentation/expression-resolver'
import { resolveMotionGroups } from './presentation/motion-resolver'
import type { ExpressionLayerState, ModelManifest, MotionQueueItem, PresentationDebugSnapshot, PresentationIntent, PresentationSnapshot, ResolvedPetModel, SemanticAction, SystemParameterSource } from './live2d.types'
import type { PresentationDriver } from './presentation/presentation-driver'

export class Live2DManager implements PresentationDriver {
  private activeModel: ResolvedPetModel | null = null

  constructor(
    private readonly renderer: PixiLive2DRendererAdapter,
    private readonly updateStatus: (modelId: string, status: 'READY' | 'LOADING' | 'FAILED', error?: string | null) => Promise<unknown>
  ) {}

  async loadModel(model: ResolvedPetModel): Promise<void> {
    this.activeModel = model
    await this.updateStatus(model.modelId, 'LOADING')
    try {
      await this.renderer.load(model.modelUrl)
      await this.renderer.playMotion(resolveMotionGroups(model.manifest, 'idle'), { name: 'idle', priority: 0, intensity: 1, loop: true, source: 'system', interruptPolicy: 'cancel' })
      await this.updateStatus(model.modelId, 'READY')
    } catch (error) {
      await this.renderer.unloadModel()
      this.activeModel = null
      const message = error instanceof Error ? error.message : '模型加载失败'
      await this.updateStatus(model.modelId, 'FAILED', message)
      throw error
    }
  }

  async changeModel(model: ResolvedPetModel): Promise<void> {
    if (this.activeModel?.modelId === model.modelId) return
    await this.loadModel(model)
  }

  async unloadModel(): Promise<void> {
    this.activeModel = null
    await this.renderer.unloadModel()
  }

  async play(item: MotionQueueItem): Promise<boolean> {
    const manifest = this.activeModel?.manifest
    if (!manifest) return false
    return this.renderer.playMotion(resolveMotionGroups(manifest, item.name), item)
  }

  stop(): void {
    this.renderer.stopMotion()
  }

  onFinished(callback: () => void): () => void {
    return this.renderer.onMotionFinished(callback)
  }

  async apply(intent: PresentationIntent): Promise<void> {
    if (intent.expression) await this.applyExpressionLayers([{ source: intent.expression.source, name: intent.expression.name ?? 'calm', priority: intent.expression.priority, intensity: intent.expression.intensity, curve: intent.expression.curve, loop: true }])
    if (intent.motion?.name) await this.play({ ...intent.motion, name: intent.motion.name })
  }

  async applyExpressionLayers(layers: ExpressionLayerState[]): Promise<Record<string, number>> {
    const manifest = this.activeModel?.manifest
    if (!manifest) return {}
    const profiles: Record<string, NonNullable<ModelManifest['expressionProfiles']>[string]> = {}
    for (const layer of layers) {
      const profile = resolveExpressionProfile(manifest, layer.name)
      if (profile) profiles[layer.name] = profile
    }
    this.renderer.setExpressionLayers(layers.filter((layer) => Boolean(profiles[layer.name])), profiles)
    return this.renderer.getFinalParameters()
  }

  clearExpressionLayers(): void {
    this.renderer.clearExpressionLayers()
  }

  setSystemParameterLayer(source: SystemParameterSource, parameters: Record<string, number>): void {
    this.renderer.setSystemParameterLayer(source, parameters)
  }

  clearSystemParameterLayer(source: SystemParameterSource): void {
    this.renderer.clearSystemParameterLayer(source)
  }

  restore(snapshot: PresentationSnapshot): void {
    void this.applyExpressionLayers(snapshot.expressionLayers)
  }

  getManifest(): ModelManifest | null {
    return this.activeModel?.manifest ?? null
  }

  getFinalParameters(): Record<string, number> {
    return this.renderer.getFinalParameters()
  }

  getDebugSnapshot(): PresentationDebugSnapshot | null {
    return null
  }

  async playMotion(action: SemanticAction): Promise<boolean> {
    return this.play({ name: action, priority: 80, intensity: 1, loop: false, source: 'interaction', interruptPolicy: 'cancel' })
  }

  async setExpression(expression: string): Promise<boolean> {
    if (!this.activeModel?.manifest.capabilities.expressions.includes(expression)) return false
    return this.renderer.setExpression(expression)
  }

  isHitAt(clientX: number, clientY: number): boolean {
    return this.renderer.isHitAt(clientX, clientY)
  }

  resize(): void {
    this.renderer.resize()
  }

  destroy(): void {
    this.renderer.destroy()
    this.activeModel = null
  }
}

