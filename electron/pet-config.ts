import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export interface PetPosition {
  x: number
  y: number
}

export interface PetConfig {
  enabled: boolean
  modelId: string
  scale: number
  position: PetPosition | null
  alwaysOnTop: boolean
  disabledModelIds: string[]
}

const DEFAULT_CONFIG: PetConfig = {
  enabled: true,
  modelId: 'hiyori_free',
  scale: 1,
  position: null,
  alwaysOnTop: true,
  disabledModelIds: []
}

export class PetConfigStore {
  private readonly filePath = join(app.getPath('userData'), 'pet.json')
  private config: PetConfig = { ...DEFAULT_CONFIG }

  load(): PetConfig {
    try {
      if (!existsSync(this.filePath)) {
        this.persist()
        return this.get()
      }
      const parsed: unknown = JSON.parse(readFileSync(this.filePath, 'utf-8'))
      this.config = this.normalize(parsed)
    } catch {
      this.config = { ...DEFAULT_CONFIG }
    }
    return this.get()
  }

  get(): PetConfig {
    return {
      ...this.config,
      position: this.config.position ? { ...this.config.position } : null,
      disabledModelIds: [...this.config.disabledModelIds]
    }
  }

  update(patch: Partial<PetConfig>): PetConfig {
    this.config = this.normalize({ ...this.config, ...patch })
    this.persist()
    return this.get()
  }

  private persist(): void {
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(this.config, null, 2), 'utf-8')
  }

  private normalize(value: unknown): PetConfig {
    const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    const scale = typeof input.scale === 'number' && Number.isFinite(input.scale)
      ? Math.min(1.5, Math.max(0.6, input.scale))
      : DEFAULT_CONFIG.scale
    const rawPosition = input.position && typeof input.position === 'object' ? input.position as Record<string, unknown> : null
    const position = rawPosition && typeof rawPosition.x === 'number' && typeof rawPosition.y === 'number'
      ? { x: Math.round(rawPosition.x), y: Math.round(rawPosition.y) }
      : null
    const disabledModelIds = Array.isArray(input.disabledModelIds)
      ? [...new Set(input.disabledModelIds.filter((id): id is string => typeof id === 'string' && /^[a-z0-9_-]{1,64}$/i.test(id)))]
      : []

    return {
      enabled: typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_CONFIG.enabled,
      modelId: typeof input.modelId === 'string' && /^[a-z0-9_-]{1,64}$/i.test(input.modelId) ? input.modelId : DEFAULT_CONFIG.modelId,
      scale,
      position,
      alwaysOnTop: typeof input.alwaysOnTop === 'boolean' ? input.alwaysOnTop : DEFAULT_CONFIG.alwaysOnTop,
      disabledModelIds
    }
  }
}

