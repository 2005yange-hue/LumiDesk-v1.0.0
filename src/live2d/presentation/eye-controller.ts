import type { EyeTrackingConfig } from '../live2d.types'

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value))
}

export class EyeController {
  private config: EyeTrackingConfig | undefined
  private target = { x: 0, y: 0 }
  private current = { x: 0, y: 0 }

  configure(config: EyeTrackingConfig | undefined): void {
    this.config = config?.enabled ? config : undefined
    if (!this.config) this.reset()
  }

  updatePointer(clientX: number, clientY: number, width: number, height: number): void {
    if (!this.config || width <= 0 || height <= 0) return
    this.target.x = clamp((clientX / width - 0.5) * 2)
    this.target.y = clamp((clientY / height - 0.5) * 2)
  }

  leave(): void {
    this.target = { x: 0, y: 0 }
  }

  step(): Record<string, number> {
    if (!this.config) return {}
    const smoothing = Math.max(0.02, Math.min(0.8, this.config.smoothing ?? 0.18))
    const range = Math.max(0, Math.min(1, this.config.range ?? 0.35))
    this.current.x += (this.target.x - this.current.x) * smoothing
    this.current.y += (this.target.y - this.current.y) * smoothing
    const parameters: Record<string, number> = {}
    if (this.config.parameters.x) parameters[this.config.parameters.x] = this.current.x * range
    if (this.config.parameters.y) parameters[this.config.parameters.y] = this.current.y * range
    return parameters
  }

  isEnabled(): boolean {
    return Boolean(this.config)
  }

  reset(): void {
    this.target = { x: 0, y: 0 }
    this.current = { x: 0, y: 0 }
  }
}
