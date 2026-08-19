import { applyIntensityCurve, clampIntensity } from './intensity-curve'
import type { ExpressionParameter, IntensityCurve } from '../live2d.types'

export interface ParameterAccessor {
  getMinimum(parameter: string): number
  getMaximum(parameter: string): number
  getValue(parameter: string): number
  setValue(parameter: string, value: number, weight?: number): void
}

function mapStandardToModel(value: number, sourceMin: number, sourceMax: number, modelMin: number, modelMax: number): number {
  if (sourceMax === sourceMin) return modelMin
  const normalized = (value - sourceMin) / (sourceMax - sourceMin)
  return modelMin + normalized * (modelMax - modelMin)
}

export function normalizeParameter(parameter: ExpressionParameter, intensity: number, curve: IntensityCurve, accessor: ParameterAccessor): number | null {
  const current = accessor.getValue(parameter.parameter)
  if (!Number.isFinite(current)) return null
  const sourceMin = parameter.sourceRange?.min ?? -1
  const sourceMax = parameter.sourceRange?.max ?? 1
  const modelMin = accessor.getMinimum(parameter.parameter)
  const modelMax = accessor.getMaximum(parameter.parameter)
  const curvedIntensity = applyIntensityCurve(clampIntensity(intensity), curve)
  const neutral = mapStandardToModel(0, sourceMin, sourceMax, modelMin, modelMax)
  const targetValue = parameter.value * curvedIntensity
  const target = Math.min(modelMax, Math.max(modelMin, mapStandardToModel(targetValue, sourceMin, sourceMax, modelMin, modelMax)))
  if (parameter.blend === 'additive') accessor.setValue(parameter.parameter, current + (target - neutral), 1)
  else if (parameter.blend === 'multiply') accessor.setValue(parameter.parameter, current * (neutral === 0 ? 1 : target / neutral), 1)
  else accessor.setValue(parameter.parameter, target, 1)
  return target
}

export function applyParameterProfile(profile: ExpressionParameter[], intensity: number, curve: IntensityCurve, accessor: ParameterAccessor): Record<string, number> {
  const values: Record<string, number> = {}
  for (const parameter of profile) {
    const value = normalizeParameter(parameter, intensity, curve, accessor)
    if (value !== null) values[parameter.parameter] = value
  }
  return values
}
