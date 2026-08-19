import type { ExpressionLayerState, ExpressionProfile, MotionQueueItem, SystemParameterSource } from './live2d.types'
import { applyParameterProfile, type ParameterAccessor } from './presentation/parameter-normalizer'

interface PixiApplication {
  view: HTMLCanvasElement
  stage: { addChild: (model: Live2DModelInstance) => void, removeChild: (model: Live2DModelInstance) => void }
  renderer: { width: number, height: number, resize: (width: number, height: number) => void, render?: (displayObject: unknown) => void }
  ticker?: { start?: () => void }
  destroy: (removeView?: boolean, options?: { children?: boolean, texture?: boolean, baseTexture?: boolean }) => void
}

interface CubismCoreModel {
  getParameterValueById: (id: string) => number
  getParameterMinimumValueById?: (id: string) => number
  getParameterMaximumValueById?: (id: string) => number
  getParameterMinimumValue?: (index: number) => number
  getParameterMaximumValue?: (index: number) => number
  getParameterCount?: () => number
  setParameterValueById: (id: string, value: number, weight?: number) => void
  getParameterIndex?: (id: string) => number
}

interface InternalLive2DModel {
  hitAreas?: Record<string, unknown>
  coreModel?: CubismCoreModel
  width?: number
  height?: number
  motionManager?: {
    isFinished?: () => boolean
    stopAllMotions?: () => void
    on?: (event: string, listener: () => void) => void
    off?: (event: string, listener: () => void) => void
  }
  on?: (event: string, listener: () => void) => void
  off?: (event: string, listener: () => void) => void
}

interface Live2DModelInstance {
  width: number
  height: number
  anchor: { set: (x: number, y: number) => void }
  position: { set: (x: number, y: number) => void }
  scale: { set: (x: number, y?: number) => void }
  motion: (group: string) => Promise<boolean>
  expression: (expression: string) => Promise<boolean>
  hitTest?: (x: number, y: number) => string[]
  containsPoint?: (point: { x: number, y: number }) => boolean
  getLocalBounds?: () => { width: number, height: number }
  autoUpdate?: boolean
  visible?: boolean
  renderable?: boolean
  alpha?: number
  internalModel?: InternalLive2DModel
  destroy: (options?: { children?: boolean, texture?: boolean, baseTexture?: boolean }) => void
}

interface PixiRuntime {
  Application: new (options: Record<string, unknown>) => PixiApplication
  live2d?: { Live2DModel?: { from: (modelUrl: string) => Promise<Live2DModelInstance> } }
}

function getPixiRuntime(): PixiRuntime {
  const runtime = (window as Window & { PIXI?: PixiRuntime }).PIXI
  if (!runtime?.Application || !runtime.live2d?.Live2DModel) throw new Error('Pixi Live2D 运行时尚未加载')
  return runtime
}

function cloneLayers(layers: ExpressionLayerState[]): ExpressionLayerState[] {
  return layers.map((layer) => ({ ...layer }))
}

export class PixiLive2DRendererAdapter {
  private application: PixiApplication | null = null
  private model: Live2DModelInstance | null = null
  private container: HTMLElement | null = null
  private baseModelSize: { width: number, height: number } | null = null
  private expressionLayers: ExpressionLayerState[] = []
  private expressionProfiles: Record<string, ExpressionProfile> = {}
  private readonly systemParameterLayers = new Map<SystemParameterSource, Record<string, number>>()
  private readonly parameterBaselines = new Map<string, number>()
  private finalParameters: Record<string, number> = {}
  private readonly motionFinishedListeners = new Set<() => void>()
  private motionMonitorFrame: number | null = null
  private motionMonitorToken = 0
  private beforeUpdateAttached = false
  private motionFinishedAttached = false
  private oneShotMotionPending = false

  async mount(container: HTMLElement): Promise<void> {
    this.container = container
    const runtime = getPixiRuntime()
    this.application = new runtime.Application({
      width: Math.max(1, container.clientWidth),
      height: Math.max(1, container.clientHeight),
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      autoStart: true,
      sharedTicker: true,
      clearBeforeRender: true
    })
    this.application.ticker?.start?.()
    this.application.view.classList.add('live2d-canvas')
    container.replaceChildren(this.application.view)
  }

  async load(modelUrl: string): Promise<void> {
    if (!this.application) throw new Error('Live2D 渲染器尚未挂载')
    await this.unloadModel()
    this.model = await getPixiRuntime().live2d!.Live2DModel!.from(modelUrl)
    this.model.anchor.set(0.5, 1)
    this.model.autoUpdate = true
    this.model.visible = true
    this.model.renderable = true
    this.model.alpha = 1
    this.application.stage.addChild(this.model)
    this.baseModelSize = this.readModelSize()
    if (!this.baseModelSize) throw new Error('Live2D 模型尺寸无效，无法初始化渲染')
    this.attachBeforeModelUpdate()
    this.fitModel()
    this.renderNow()
    window.requestAnimationFrame(() => {
      const updatedSize = this.readModelSize()
      if (updatedSize) this.baseModelSize = updatedSize
      this.fitModel()
      this.renderNow()
    })
  }

  async unloadModel(): Promise<void> {
    this.cancelMotionMonitor()
    this.detachMotionFinished()
    this.detachBeforeModelUpdate()
    this.expressionLayers = []
    this.expressionProfiles = {}
    this.systemParameterLayers.clear()
    this.parameterBaselines.clear()
    this.finalParameters = {}
    this.baseModelSize = null
    if (!this.model) return
    this.application?.stage.removeChild(this.model)
    this.model.destroy({ children: true, texture: true, baseTexture: true })
    this.model = null
  }

  async playMotion(groups: string[], item?: MotionQueueItem): Promise<boolean> {
    if (!this.model) return false
    this.cancelMotionMonitor()
    this.oneShotMotionPending = !item?.loop
    for (const group of groups) {
      try {
        if (await this.model.motion(group)) {
          if (!item?.loop) this.watchOneShotMotion()
          return true
        }
      } catch {
        continue
      }
    }
    return false
  }

  stopMotion(): void {
    this.cancelMotionMonitor()
    this.oneShotMotionPending = false
    this.model?.internalModel?.motionManager?.stopAllMotions?.()
  }

  onMotionFinished(listener: () => void): () => void {
    this.motionFinishedListeners.add(listener)
    return () => this.motionFinishedListeners.delete(listener)
  }

  async setExpression(expression: string): Promise<boolean> {
    if (!this.model) return false
    try {
      return await this.model.expression(expression)
    } catch {
      return false
    }
  }

  setExpressionLayers(layers: ExpressionLayerState[], profiles: Record<string, ExpressionProfile>): void {
    this.expressionLayers = cloneLayers(layers)
    this.expressionProfiles = profiles
    this.beforeModelUpdate()
  }

  clearExpressionLayers(): void {
    this.expressionLayers = []
    this.beforeModelUpdate()
  }

  setSystemParameterLayer(source: SystemParameterSource, parameters: Record<string, number>): void {
    this.systemParameterLayers.set(source, { ...parameters })
    this.beforeModelUpdate()
  }

  clearSystemParameterLayer(source: SystemParameterSource): void {
    this.systemParameterLayers.delete(source)
    this.beforeModelUpdate()
  }

  getFinalParameters(): Record<string, number> {
    return { ...this.finalParameters }
  }

  isHitAt(clientX: number, clientY: number): boolean {
    if (!this.model || !this.application) return false
    const bounds = this.application.view.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return false
    const x = (clientX - bounds.left) * this.application.renderer.width / bounds.width
    const y = (clientY - bounds.top) * this.application.renderer.height / bounds.height
    if (x < 0 || y < 0 || x > this.application.renderer.width || y > this.application.renderer.height) return false
    const hitAreas = this.model.internalModel?.hitAreas
    if (this.model.hitTest) {
      const hits = this.model.hitTest(x, y)
      if (hits.length > 0) return true
      if (hitAreas && Object.keys(hitAreas).length > 0) return false
    }
    return this.model.containsPoint?.({ x, y }) ?? false
  }

  resize(): void {
    if (!this.application || !this.container) return
    this.application.renderer.resize(Math.max(1, this.container.clientWidth), Math.max(1, this.container.clientHeight))
    this.fitModel()
  }

  destroy(): void {
    void this.unloadModel()
    this.application?.destroy(true, { children: true, texture: true, baseTexture: true })
    this.application = null
    this.container?.replaceChildren()
    this.container = null
    this.motionFinishedListeners.clear()
  }

  private attachBeforeModelUpdate(): void {
    if (!this.model?.internalModel?.on || this.beforeUpdateAttached) return
    this.model.internalModel.on('beforeModelUpdate', this.beforeModelUpdate)
    this.beforeUpdateAttached = true
  }

  private attachMotionFinished(): void {
    const motionManager = this.model?.internalModel?.motionManager
    if (!motionManager?.on || this.motionFinishedAttached) return
    motionManager.on('motionFinish', this.motionFinished)
    this.motionFinishedAttached = true
  }

  private detachMotionFinished(): void {
    const motionManager = this.model?.internalModel?.motionManager
    if (this.motionFinishedAttached) motionManager?.off?.('motionFinish', this.motionFinished)
    this.motionFinishedAttached = false
    this.oneShotMotionPending = false
  }

  private readonly motionFinished = (): void => {
    if (!this.oneShotMotionPending) return
    this.oneShotMotionPending = false
    this.cancelMotionMonitor()
    for (const listener of this.motionFinishedListeners) listener()
  }

  private detachBeforeModelUpdate(): void {
    if (!this.beforeUpdateAttached) return
    this.model?.internalModel?.off?.('beforeModelUpdate', this.beforeModelUpdate)
    this.beforeUpdateAttached = false
  }

  private readonly beforeModelUpdate = (): void => {
    const coreModel = this.model?.internalModel?.coreModel
    if (!coreModel) return
    const accessor = this.createParameterAccessor(coreModel)
    const desiredParameters = this.collectDesiredParameters()
    for (const [parameter, baseline] of this.parameterBaselines) {
      if (!desiredParameters.has(parameter)) {
        accessor.setValue(parameter, baseline, 1)
        this.parameterBaselines.delete(parameter)
      }
    }
    this.finalParameters = {}
    for (const layer of this.expressionLayers) {
      const profile = this.expressionProfiles[layer.name]
      if (!profile?.parameters?.length) continue
      const supportedParameters = profile.parameters.filter((parameter) => this.parameterExists(parameter.parameter, coreModel))
      if (!supportedParameters.length) continue
      this.captureBaselines(supportedParameters.map((parameter) => parameter.parameter), accessor)
      Object.assign(this.finalParameters, applyParameterProfile(supportedParameters, layer.intensity, layer.curve, accessor))
    }
    for (const parameters of this.systemParameterLayers.values()) {
      this.captureBaselines(Object.keys(parameters), accessor)
      for (const [parameter, value] of Object.entries(parameters)) {
        if (!this.parameterExists(parameter, coreModel)) continue
        const minimum = accessor.getMinimum(parameter)
        const maximum = accessor.getMaximum(parameter)
        const normalized = Math.min(maximum, Math.max(minimum, value))
        accessor.setValue(parameter, normalized, 1)
        this.finalParameters[parameter] = normalized
      }
    }
  }

  private collectDesiredParameters(): Set<string> {
    const parameters = new Set<string>()
    const coreModel = this.model?.internalModel?.coreModel
    if (!coreModel) return parameters
    for (const layer of this.expressionLayers) {
      for (const parameter of this.expressionProfiles[layer.name]?.parameters ?? []) {
        if (this.parameterExists(parameter.parameter, coreModel)) parameters.add(parameter.parameter)
      }
    }
    for (const layer of this.systemParameterLayers.values()) {
      for (const parameter of Object.keys(layer)) {
        if (this.parameterExists(parameter, coreModel)) parameters.add(parameter)
      }
    }
    return parameters
  }

  private captureBaselines(parameters: string[], accessor: ParameterAccessor): void {
    for (const parameter of parameters) if (!this.parameterBaselines.has(parameter)) this.parameterBaselines.set(parameter, accessor.getValue(parameter))
  }

  private parameterExists(parameter: string, coreModel: CubismCoreModel): boolean {
    const index = coreModel.getParameterIndex?.(parameter)
    if (typeof index !== 'number' || index < 0) return false
    const count = coreModel.getParameterCount?.()
    return typeof count !== 'number' || index < count
  }

  private createParameterAccessor(coreModel: CubismCoreModel): ParameterAccessor {
    const getParameterIndex = (parameter: string): number | null => {
      const index = coreModel.getParameterIndex?.(parameter)
      return typeof index === 'number' && index >= 0 ? index : null
    }
    return {
      getMinimum: (parameter) => {
        const index = getParameterIndex(parameter)
        if (index === null) return -1
        return coreModel.getParameterMinimumValue?.(index) ?? coreModel.getParameterMinimumValueById?.(parameter) ?? -1
      },
      getMaximum: (parameter) => {
        const index = getParameterIndex(parameter)
        if (index === null) return 1
        return coreModel.getParameterMaximumValue?.(index) ?? coreModel.getParameterMaximumValueById?.(parameter) ?? 1
      },
      getValue: (parameter) => coreModel.getParameterValueById(parameter),
      setValue: (parameter, value, weight) => coreModel.setParameterValueById(parameter, value, weight)
    }
  }

  private watchOneShotMotion(): void {
    const token = ++this.motionMonitorToken
    const poll = (): void => {
      if (token !== this.motionMonitorToken) return
      const finished = this.model?.internalModel?.motionManager?.isFinished?.()
      if (finished === true) {
        this.motionMonitorFrame = null
        if (!this.oneShotMotionPending) return
        this.oneShotMotionPending = false
        for (const listener of this.motionFinishedListeners) listener()
        return
      }
      this.motionMonitorFrame = window.requestAnimationFrame(poll)
    }
    this.motionMonitorFrame = window.requestAnimationFrame(poll)
  }

  private cancelMotionMonitor(): void {
    this.motionMonitorToken += 1
    if (this.motionMonitorFrame !== null) window.cancelAnimationFrame(this.motionMonitorFrame)
    this.motionMonitorFrame = null
  }

  private fitModel(): void {
    if (!this.application || !this.model || !this.baseModelSize) return
    const { width, height } = this.application.renderer
    const heightScale = height * 0.92 / this.baseModelSize.height
    const widthScale = width * 0.92 / this.baseModelSize.width
    this.model.scale.set(Math.min(heightScale, widthScale))
    this.model.position.set(width / 2, height * 0.99)
  }

  private readModelSize(): { width: number, height: number } | null {
    if (!this.model) return null
    const localBounds = this.model.getLocalBounds?.()
    const candidates: Array<{ width?: number, height?: number } | undefined> = [
      localBounds,
      { width: this.model.width, height: this.model.height },
      { width: this.model.internalModel?.width, height: this.model.internalModel?.height }
    ]
    for (const candidate of candidates) {
      const width = candidate?.width
      const height = candidate?.height
      if (typeof width !== 'number' || typeof height !== 'number' || !Number.isFinite(width) || !Number.isFinite(height)) continue
      if (width > 0.01 && height > 0.01) return { width, height }
    }
    return null
  }

  private renderNow(): void {
    if (!this.application) return
    this.application.renderer.render?.(this.application.stage)
  }
}



