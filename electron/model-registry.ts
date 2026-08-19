import { existsSync, mkdirSync, readdirSync, readFileSync } from 'fs'
import { basename, join, relative, resolve, sep } from 'path'

export type ModelStatus = 'READY' | 'INVALID' | 'LOADING' | 'FAILED' | 'DISABLED'
export type ModelSource = 'bundled' | 'extension'

export interface ModelCapabilities {
  motions: string[]
  expressions: string[]
  physics: boolean
  lipSync: boolean
}

export interface ExpressionParameter {
  parameter: string
  value: number
  sourceRange?: { min: number, max: number }
  blend: 'overwrite' | 'additive' | 'multiply'
}

export interface ExpressionProfile {
  native?: string
  parameters?: ExpressionParameter[]
}

export interface ModelFeatures {
  expression: boolean
  motion: boolean
  physics: boolean
  eyeTracking: boolean
  lipSync: boolean
  breathing: boolean
}

export interface EyeTrackingConfig {
  enabled: boolean
  parameters: { x?: string, y?: string }
  smoothing?: number
  range?: number
}

export interface BreathingConfig {
  enabled: boolean
  parameters: { breath?: string, bodyAngleX?: string, bodyAngleY?: string }
  profile?: { inhaleSeconds?: number, exhaleSeconds?: number, variation?: number }
}

export interface LipSyncConfig { parameter?: string; smoothing?: number; range?: number }

export interface ModelManifest {
  id: string
  name: string
  author: string
  version: string
  appearanceType: 'live2d'
  runtime: 'cubism3' | 'cubism4'
  modelPath: string
  preview: string | null
  capabilities: ModelCapabilities
  features: ModelFeatures
  semanticActions: Record<string, string[]>
  expressionProfiles: Record<string, ExpressionProfile>
  eyeTracking?: EyeTrackingConfig
  breathing?: BreathingConfig
  lipSync?: LipSyncConfig
}

export interface RegisteredModel {
  id: string
  name: string
  author: string
  version: string
  appearanceType: ModelManifest['appearanceType']
  runtime: ModelManifest['runtime']
  previewUrl: string | null
  capabilities: ModelCapabilities
  features: ModelFeatures
  status: ModelStatus
  error: string | null
  source: ModelSource
}

interface ModelRecord {
  manifest: ModelManifest
  root: string
  source: ModelSource
  status: Exclude<ModelStatus, 'DISABLED'>
  error: string | null
}

const MODEL_ID_PATTERN = /^[a-z0-9_-]{1,64}$/i

export class ModelRegistry {
  private readonly records = new Map<string, ModelRecord>()
  private readonly invalid = new Map<string, RegisteredModel>()

  constructor(private readonly bundledRoot: string, private readonly extensionRoot: string) {}

  reload(disabledModelIds: string[] = []): RegisteredModel[] {
    this.records.clear()
    this.invalid.clear()
    this.scanRoot(this.bundledRoot, 'bundled')
    this.scanRoot(this.extensionRoot, 'extension')
    return this.list(disabledModelIds)
  }

  list(disabledModelIds: string[] = []): RegisteredModel[] {
    const disabled = new Set(disabledModelIds)
    const valid = [...this.records.values()].map((record) => this.toPublic(record, disabled.has(record.manifest.id)))
    return [...valid, ...this.invalid.values()].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
  }

  getDefaultId(disabledModelIds: string[] = []): string | null {
    const disabled = new Set(disabledModelIds)
    if (this.records.has('hiyori_free') && !disabled.has('hiyori_free')) return 'hiyori_free'
    return [...this.records.keys()].find((id) => !disabled.has(id)) ?? null
  }

  getManifest(id: string): ModelManifest | null {
    return this.records.get(id)?.manifest ?? null
  }

  resolveModelPath(id: string): string | null {
    const record = this.records.get(id)
    return record ? resolve(record.root, record.manifest.modelPath) : null
  }

  setRuntimeStatus(id: string, status: Extract<ModelStatus, 'READY' | 'LOADING' | 'FAILED'>, error: string | null = null): void {
    const record = this.records.get(id)
    if (!record) return
    record.status = status
    record.error = status === 'FAILED' ? (error || '模型运行时加载失败') : null
  }

  private scanRoot(root: string, source: ModelSource): void {
    mkdirSync(root, { recursive: true })
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !MODEL_ID_PATTERN.test(entry.name)) continue
      const modelRoot = join(root, entry.name)
      const manifestPath = join(modelRoot, 'model.json')
      if (!existsSync(manifestPath)) continue
      try {
        const manifest = this.parseManifest(readFileSync(manifestPath, 'utf-8'))
        if (manifest.id !== entry.name) throw new Error('模型目录名必须与 model.json 的 id 一致')
        if (source === 'extension' && this.records.has(manifest.id)) {
          this.invalid.set(`extension:${manifest.id}`, this.invalidModel(manifest, source, '扩展模型不能覆盖同 ID 的内置模型'))
          continue
        }
        const modelPath = resolve(modelRoot, manifest.modelPath)
        if (!this.isInside(modelRoot, modelPath) || !existsSync(modelPath)) throw new Error('modelPath 指向的模型文件不存在')
        this.validateCubismAssets(modelRoot, modelPath)
        this.records.set(manifest.id, { manifest, root: modelRoot, source, status: 'READY', error: null })
      } catch (error) {
        this.invalid.set(`${source}:${entry.name}`, this.invalidFromDirectory(entry.name, source, error))
      }
    }
  }

  private parseManifest(raw: string): ModelManifest {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') throw new Error('model.json 必须是对象')
    const input = value as Record<string, unknown>
    if (!this.isString(input.id) || !MODEL_ID_PATTERN.test(input.id)) throw new Error('模型 id 非法')
    if (!this.isString(input.name) || !this.isString(input.author) || !this.isString(input.version)) throw new Error('模型名称、作者和版本不能为空')
    if (input.appearanceType !== 'live2d') throw new Error('当前仅支持 live2d 形象类型')
    if (input.runtime !== 'cubism3' && input.runtime !== 'cubism4') throw new Error('当前仅支持 Cubism 3/4 运行时')
    if (!this.isString(input.modelPath) || !this.isSafeRelativePath(input.modelPath)) throw new Error('modelPath 非法')
    if (input.preview !== null && input.preview !== undefined && (!this.isString(input.preview) || !this.isSafeRelativePath(input.preview))) throw new Error('preview 路径非法')
    const capabilities = this.parseCapabilities(input.capabilities)
    return {
      id: input.id,
      name: input.name,
      author: input.author,
      version: input.version,
      appearanceType: 'live2d',
      runtime: input.runtime,
      modelPath: input.modelPath,
      preview: this.isString(input.preview) ? input.preview : null,
      capabilities,
      features: this.parseFeatures(input.features, capabilities),
      semanticActions: this.parseSemanticActions(input.semanticActions),
      expressionProfiles: this.parseExpressionProfiles(input.expressionProfiles),
      eyeTracking: this.parseEyeTracking(input.eyeTracking),
      breathing: this.parseBreathing(input.breathing)
      ,lipSync: this.parseLipSync(input.lipSync)
    }
  }

  private parseCapabilities(value: unknown): ModelCapabilities {
    if (!value || typeof value !== 'object') throw new Error('capabilities 缺失')
    const input = value as Record<string, unknown>
    const asStrings = (candidate: unknown) => Array.isArray(candidate) && candidate.every((item) => typeof item === 'string') ? candidate : null
    const motions = asStrings(input.motions)
    const expressions = asStrings(input.expressions)
    if (!motions || !expressions || typeof input.physics !== 'boolean' || typeof input.lipSync !== 'boolean') throw new Error('capabilities 格式无效')
    return { motions, expressions, physics: input.physics, lipSync: input.lipSync }
  }

  private parseFeatures(value: unknown, capabilities: ModelCapabilities): ModelFeatures {
    const defaults: ModelFeatures = {
      expression: capabilities.expressions.length > 0,
      motion: capabilities.motions.length > 0,
      physics: capabilities.physics,
      eyeTracking: false,
      lipSync: capabilities.lipSync,
      breathing: false
    }
    if (value === undefined) return defaults
    if (!value || typeof value !== 'object') throw new Error('features 格式无效')
    const input = value as Record<string, unknown>
    const keys = Object.keys(defaults) as Array<keyof ModelFeatures>
    for (const key of keys) if (input[key] !== undefined && typeof input[key] !== 'boolean') throw new Error(`features.${key} 必须为布尔值`)
    return { ...defaults, ...Object.fromEntries(keys.filter((key) => typeof input[key] === 'boolean').map((key) => [key, input[key]])) } as ModelFeatures
  }

  private parseLipSync(value: unknown): LipSyncConfig | undefined {
    if (value === undefined) return undefined
    if (!value || typeof value !== 'object') throw new Error('lipSync 格式无效')
    const input = value as Record<string, unknown>
    if (input.parameter !== undefined && typeof input.parameter !== 'string') throw new Error('lipSync.parameter 必须为字符串')
    if (input.smoothing !== undefined && (typeof input.smoothing !== 'number' || input.smoothing < 0 || input.smoothing > 1)) throw new Error('lipSync.smoothing 范围无效')
    if (input.range !== undefined && (typeof input.range !== 'number' || input.range <= 0)) throw new Error('lipSync.range 必须为正数')
    return { parameter: input.parameter as string | undefined, smoothing: input.smoothing as number | undefined, range: input.range as number | undefined }
  }

  private parseSemanticActions(value: unknown): Record<string, string[]> {
    if (!value || typeof value !== 'object') throw new Error('semanticActions 缺失')
    const actions: Record<string, string[]> = {}
    for (const [key, candidate] of Object.entries(value as Record<string, unknown>)) {
      if (!/^[a-z0-9_-]{1,64}$/i.test(key) || !Array.isArray(candidate) || candidate.some((item) => typeof item !== 'string')) throw new Error('semanticActions 格式无效')
      actions[key] = candidate
    }
    if (!actions.idle?.length) throw new Error('semanticActions 必须提供 idle 回退动作')
    return actions
  }

  private parseExpressionProfiles(value: unknown): Record<string, ExpressionProfile> {
    if (value === undefined) return {}
    if (!value || typeof value !== 'object') throw new Error('expressionProfiles 格式无效')
    const profiles: Record<string, ExpressionProfile> = {}
    for (const [name, candidate] of Object.entries(value as Record<string, unknown>)) {
      if (!/^[a-z0-9_-]{1,64}$/i.test(name) || !candidate || typeof candidate !== 'object') throw new Error('expressionProfiles 条目无效')
      const input = candidate as Record<string, unknown>
      if (input.native !== undefined && !this.isString(input.native)) throw new Error('expressionProfiles.native 无效')
      if (input.parameters !== undefined && !Array.isArray(input.parameters)) throw new Error('expressionProfiles.parameters 无效')
      const parameters: ExpressionParameter[] = []
      for (const item of input.parameters ?? []) {
        if (!item || typeof item !== 'object') throw new Error('expressionProfiles 参数无效')
        const parameter = item as Record<string, unknown>
        if (!this.isString(parameter.parameter) || typeof parameter.value !== 'number' || !Number.isFinite(parameter.value)) throw new Error('expressionProfiles 参数名称或值无效')
        if (parameter.blend !== 'overwrite' && parameter.blend !== 'additive' && parameter.blend !== 'multiply') throw new Error('expressionProfiles blend 无效')
        let sourceRange: { min: number, max: number } | undefined
        if (parameter.sourceRange !== undefined) {
          if (!parameter.sourceRange || typeof parameter.sourceRange !== 'object') throw new Error('expressionProfiles sourceRange 无效')
          const range = parameter.sourceRange as Record<string, unknown>
          if (typeof range.min !== 'number' || typeof range.max !== 'number' || !Number.isFinite(range.min) || !Number.isFinite(range.max) || range.max <= range.min) throw new Error('expressionProfiles sourceRange 边界无效')
          sourceRange = { min: range.min, max: range.max }
        }
        parameters.push({ parameter: parameter.parameter, value: parameter.value, blend: parameter.blend, ...(sourceRange ? { sourceRange } : {}) })
      }
      profiles[name] = { ...(this.isString(input.native) ? { native: input.native } : {}), ...(parameters.length ? { parameters } : {}) }
    }
    return profiles
  }

  private parseEyeTracking(value: unknown): EyeTrackingConfig | undefined {
    if (value === undefined) return undefined
    if (!value || typeof value !== 'object') throw new Error('eyeTracking 格式无效')
    const input = value as Record<string, unknown>
    if (typeof input.enabled !== 'boolean' || !input.parameters || typeof input.parameters !== 'object') throw new Error('eyeTracking 配置无效')
    const parameters = input.parameters as Record<string, unknown>
    if (parameters.x !== undefined && !this.isString(parameters.x)) throw new Error('eyeTracking.x 无效')
    if (parameters.y !== undefined && !this.isString(parameters.y)) throw new Error('eyeTracking.y 无效')
    if (typeof input.smoothing !== 'undefined' && (typeof input.smoothing !== 'number' || input.smoothing <= 0 || input.smoothing > 1)) throw new Error('eyeTracking.smoothing 无效')
    if (typeof input.range !== 'undefined' && (typeof input.range !== 'number' || input.range < 0 || input.range > 1)) throw new Error('eyeTracking.range 无效')
    return { enabled: input.enabled, parameters: { ...(this.isString(parameters.x) ? { x: parameters.x } : {}), ...(this.isString(parameters.y) ? { y: parameters.y } : {}) }, ...(typeof input.smoothing === 'number' ? { smoothing: input.smoothing } : {}), ...(typeof input.range === 'number' ? { range: input.range } : {}) }
  }

  private parseBreathing(value: unknown): BreathingConfig | undefined {
    if (value === undefined) return undefined
    if (!value || typeof value !== 'object') throw new Error('breathing 格式无效')
    const input = value as Record<string, unknown>
    if (typeof input.enabled !== 'boolean' || !input.parameters || typeof input.parameters !== 'object') throw new Error('breathing 配置无效')
    const parameters = input.parameters as Record<string, unknown>
    for (const key of ['breath', 'bodyAngleX', 'bodyAngleY']) if (parameters[key] !== undefined && !this.isString(parameters[key])) throw new Error(`breathing.${key} 无效`)
    const profileInput = input.profile
    if (profileInput !== undefined && (!profileInput || typeof profileInput !== 'object')) throw new Error('breathing.profile 无效')
    const profile = profileInput as Record<string, unknown> | undefined
    for (const key of ['inhaleSeconds', 'exhaleSeconds', 'variation']) if (profile?.[key] !== undefined && (typeof profile[key] !== 'number' || !Number.isFinite(profile[key]))) throw new Error(`breathing.profile.${key} 无效`)
    return {
      enabled: input.enabled,
      parameters: { ...(this.isString(parameters.breath) ? { breath: parameters.breath } : {}), ...(this.isString(parameters.bodyAngleX) ? { bodyAngleX: parameters.bodyAngleX } : {}), ...(this.isString(parameters.bodyAngleY) ? { bodyAngleY: parameters.bodyAngleY } : {}) },
      ...(profile ? { profile: { ...(typeof profile.inhaleSeconds === 'number' ? { inhaleSeconds: profile.inhaleSeconds } : {}), ...(typeof profile.exhaleSeconds === 'number' ? { exhaleSeconds: profile.exhaleSeconds } : {}), ...(typeof profile.variation === 'number' ? { variation: profile.variation } : {}) } } : {})
    }
  }

  private validateCubismAssets(modelRoot: string, modelPath: string): void {
    const modelJson: unknown = JSON.parse(readFileSync(modelPath, 'utf-8'))
    const references = modelJson && typeof modelJson === 'object' ? (modelJson as { FileReferences?: unknown }).FileReferences : null
    if (!references || typeof references !== 'object') throw new Error('model3.json 缺少 FileReferences')
    const source = references as Record<string, unknown>
    const files: string[] = []
    for (const key of ['Moc', 'Physics', 'Pose', 'DisplayInfo']) if (typeof source[key] === 'string') files.push(source[key])
    if (Array.isArray(source.Textures)) files.push(...source.Textures.filter((item): item is string => typeof item === 'string'))
    if (!files.length) throw new Error('model3.json 未声明基础资源')
    const modelDirectory = resolve(modelPath, '..')
    for (const file of files) {
      const target = resolve(modelDirectory, file)
      if (!this.isInside(modelRoot, target) || !existsSync(target)) throw new Error(`缺少模型资源：${basename(file)}`)
    }
  }

  private toPublic(record: ModelRecord, disabled: boolean): RegisteredModel {
    return {
      id: record.manifest.id,
      name: record.manifest.name,
      author: record.manifest.author,
      version: record.manifest.version,
      appearanceType: record.manifest.appearanceType,
      runtime: record.manifest.runtime,
      previewUrl: null,
      capabilities: record.manifest.capabilities,
      features: record.manifest.features,
      status: disabled ? 'DISABLED' : record.status,
      error: disabled ? '模型已在桌宠设置中禁用' : record.error,
      source: record.source
    }
  }

  private invalidModel(manifest: ModelManifest, source: ModelSource, error: string): RegisteredModel {
    return { ...this.toPublic({ manifest, root: '', source, status: 'READY', error: null }, false), status: 'INVALID', error }
  }

  private invalidFromDirectory(id: string, source: ModelSource, error: unknown): RegisteredModel {
    return {
      id,
      name: id,
      author: '未知',
      version: '未知',
      appearanceType: 'live2d',
      runtime: 'cubism3',
      previewUrl: null,
      capabilities: { motions: [], expressions: [], physics: false, lipSync: false },
      features: { expression: false, motion: false, physics: false, eyeTracking: false, lipSync: false, breathing: false },
      status: 'INVALID',
      error: error instanceof Error ? error.message : '模型元数据无效',
      source
    }
  }

  private isString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0
  }

  private isSafeRelativePath(value: string): boolean {
    return !value.includes('\\') && !value.startsWith('/') && !value.split('/').some((part) => part === '..' || part.length === 0)
  }

  private isInside(root: string, target: string): boolean {
    const path = relative(resolve(root), resolve(target))
    return path !== '' && !path.startsWith(`..${sep}`) && path !== '..' && !path.startsWith('/')
  }
}

