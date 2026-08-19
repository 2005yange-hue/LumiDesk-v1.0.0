export type ModelStatus = 'READY' | 'INVALID' | 'LOADING' | 'FAILED' | 'DISABLED'
export type ModelSource = 'bundled' | 'extension'
export type SemanticAction = 'idle' | 'interact' | 'thinking' | 'speaking' | 'positive' | 'calm' | 'concerned' | 'tired'
export type PresentationState = 'idle' | 'thinking' | 'happy' | 'concerned' | 'tired' | 'excited'
export type CharacterMood = 'happy' | 'calm' | 'concerned' | 'tired'
export type PetDetectedEmotion = 'happy' | 'calm' | 'anxious' | 'sad' | 'angry' | 'tired'
export type ResponseAttitude = 'comfort' | 'encourage' | 'celebrate' | 'neutral'
export type PresentationSource = 'character_mood' | 'user_emotion' | 'chat' | 'interaction' | 'relationship' | 'voice' | 'system' | 'debug'
export type SystemParameterSource = 'eye_tracking' | 'breathing' | 'voice_lip_sync'
export type IntensityCurve = 'linear' | 'easeIn' | 'easeOut' | 'soft'
export type InterruptPolicy = 'cancel' | 'pause' | 'queue' | 'ignore'
export type ChatPresentationPhase = 'listening' | 'waiting' | 'thinking' | 'typing' | 'speaking'
export type PresentationEvent = 'chat_start' | 'chat_delta' | 'chat_complete' | 'chat_error' | 'emotion_change' | 'relationship_up' | 'character_state' | 'interaction' | 'voice_start' | 'voice_amplitude' | 'voice_complete' | 'voice_stop' | 'voice_error' | 'voice_fallback'

export interface PresentationContext {
  characterMood: CharacterMood
  userEmotion?: PetDetectedEmotion
  userEmotionIntensity?: number
  responseAttitude: ResponseAttitude
  personalityStyleId: string
  affinity?: number
  event?: PresentationEvent
}

export interface ExpressionIntent {
  name?: string
  priority: number
  intensity: number
  curve: IntensityCurve
  source: PresentationSource
}

export interface MotionIntent {
  name?: string
  priority: number
  intensity: number
  loop: boolean
  source: PresentationSource
  interruptPolicy: InterruptPolicy
}

export interface PresentationIntent {
  state: PresentationState
  expression?: ExpressionIntent
  motion?: MotionIntent
  motionQueue?: MotionQueueItem[]
}

export interface PresentationLayerState {
  source: PresentationSource
  name: string
  priority: number
  intensity: number
  curve: IntensityCurve
  loop: boolean
  duration?: number
  startedAt?: number
}

export interface ExpressionLayerState extends PresentationLayerState {}

export interface MotionQueueItem {
  name: string
  priority: number
  intensity: number
  loop: boolean
  source: PresentationSource
  interruptPolicy: InterruptPolicy
}

export interface PresentationSnapshot {
  expressionLayers: ExpressionLayerState[]
  motionLayers: PresentationLayerState[]
  motionQueue?: MotionQueueItem[]
  chatPhase?: string
  state: {
    characterMood: CharacterMood
    userEmotion?: PetDetectedEmotion
    responseAttitude: ResponseAttitude
    userEmotionIntensity?: number
  }
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

export interface LipSyncConfig {
  parameter?: string
  smoothing?: number
  range?: number
}

export interface ModelCapabilities {
  motions: string[]
  expressions: string[]
  physics: boolean
  lipSync: boolean
}

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
  features?: ModelFeatures
  semanticActions: Record<string, string[]>
  expressionProfiles?: Record<string, ExpressionProfile>
  eyeTracking?: EyeTrackingConfig
  breathing?: BreathingConfig
  lipSync?: LipSyncConfig
}

export interface RegisteredModel {
  id: string
  name: string
  author: string
  version: string
  appearanceType: 'live2d'
  runtime: 'cubism3' | 'cubism4'
  previewUrl: string | null
  capabilities: ModelCapabilities
  features?: ModelFeatures
  status: ModelStatus
  error: string | null
  source: ModelSource
}

export interface PetConfig {
  enabled: boolean
  modelId: string
  scale: number
  position: { x: number, y: number } | null
  alwaysOnTop: boolean
  disabledModelIds: string[]
}

export interface PetWindowLayout {
  menuOpen: boolean
  menuSide: 'left' | 'right'
  modelWidth: number
  modelHeight: number
  menuWidth: number
  menuHeight: number
  menuGap: number
  shellWidth: number
  shellHeight: number
}

export interface ResolvedPetModel {
  modelId: string
  manifest: ModelManifest
  modelUrl: string
}

export interface PetEvent {
  type: 'chat_start' | 'chat_delta' | 'chat_complete' | 'chat_error' | 'chat_phase' | 'character_changed' | 'character_state' | 'emotion_change' | 'relationship_up' | 'interaction' | 'notification' | 'voice_start' | 'voice_amplitude' | 'voice_complete' | 'voice_stop' | 'voice_error' | 'voice_fallback'
  payload: Record<string, unknown>
}

export interface PresentationTimelineEntry {
  timestamp: number
  event: string
  source: PresentationSource
  state?: PresentationState
  expression?: string
  motion?: string
  intensity?: number
  priority?: number
  action: 'set' | 'replace' | 'clear' | 'restore' | 'fallback' | 'error'
  layers: PresentationLayerState[]
  parameters?: Record<string, number>
}

export interface PresentationDebugSnapshot {
  model: {
    id: string
    name: string
    runtime: ModelManifest['runtime']
    capabilities: ModelCapabilities
    semanticActions: Record<string, string[]>
    expressionProfiles: Record<string, ExpressionProfile>
    features: ModelFeatures
    status?: string
  } | null
  state: PresentationState
  context: PresentationContext
  chatPhase?: string
  expression?: PresentationLayerState
  motion?: PresentationLayerState
  expressionLayers: ExpressionLayerState[]
  motionLayers: PresentationLayerState[]
  motionQueue: MotionQueueItem[]
  motionPlayback: { name?: string, played?: boolean, fallback: boolean, candidates: string[], message?: string }
  systemEnabled: Record<SystemParameterSource, boolean>
  systemParameters: Record<SystemParameterSource, Record<string, number>>
  parameters: Record<string, number>
  timeline: PresentationTimelineEntry[]
}

export interface PetSnapshot {
  config: PetConfig
  layout?: PetWindowLayout
  models: RegisteredModel[]
  characterEvent: PetEvent | null
}
