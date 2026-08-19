import type { IntensityCurve } from '../live2d.types'

export function clampIntensity(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

export function applyIntensityCurve(value: number, curve: IntensityCurve): number {
  const normalized = clampIntensity(value)
  if (curve === 'easeIn') return normalized ** 1.8
  if (curve === 'easeOut') return 1 - ((1 - normalized) ** 1.8)
  if (curve === 'soft') return normalized ** 1.6
  return normalized
}
