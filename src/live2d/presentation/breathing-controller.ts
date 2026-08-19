import type { BreathingConfig } from '../live2d.types'

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

export class BreathingController {
  private config: BreathingConfig | undefined
  private startedAt = performance.now()

  configure(config: BreathingConfig | undefined): void {
    this.config = config?.enabled ? config : undefined
    this.startedAt = performance.now()
  }

  step(now = performance.now()): Record<string, number> {
    if (!this.config) return {}
    const profile = this.config.profile ?? {}
    const inhale = Math.max(0.8, profile.inhaleSeconds ?? 2.8)
    const exhale = Math.max(0.8, profile.exhaleSeconds ?? 3.5)
    const period = inhale + exhale
    const elapsed = (now - this.startedAt) / 1_000
    const phase = (elapsed % period) / period
    const inhaleRatio = inhale / period
    const base = phase <= inhaleRatio
      ? Math.sin((phase / inhaleRatio) * Math.PI / 2)
      : Math.cos(((phase - inhaleRatio) / (1 - inhaleRatio)) * Math.PI / 2)
    const variation = clamp(profile.variation ?? 0.2, 0, 0.45)
    const drift = Math.sin(elapsed * 0.47 + 0.8) * 0.55 + Math.sin(elapsed * 0.19 + 2.1) * 0.25
    const level = clamp(base * (1 + drift * variation), 0, 1)
    const parameters: Record<string, number> = {}
    if (this.config.parameters.breath) parameters[this.config.parameters.breath] = level
    if (this.config.parameters.bodyAngleX) parameters[this.config.parameters.bodyAngleX] = Math.sin(elapsed * 0.52) * 0.55 * level
    if (this.config.parameters.bodyAngleY) parameters[this.config.parameters.bodyAngleY] = Math.sin(elapsed * 0.41 + 1.2) * 0.35 * level
    return parameters
  }

  isEnabled(): boolean {
    return Boolean(this.config)
  }
}
