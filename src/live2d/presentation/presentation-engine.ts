import type { CharacterMood, ChatPresentationPhase, IntensityCurve, InterruptPolicy, ModelManifest, PetDetectedEmotion, PetEvent, PresentationContext, PresentationDebugSnapshot, PresentationLayerState, PresentationSnapshot, PresentationSource, PresentationState, ResponseAttitude, MotionQueueItem, SystemParameterSource } from '../live2d.types'
import { resolveResponseAttitude } from './context-resolver'
import { resolvePersonalityPresentation, type PersonalityPresentationKey } from './personality-mapper'
import { clampIntensity } from './intensity-curve'
import { ExpressionManager } from './expression-manager'
import { MotionManager } from './motion-manager'
import type { PresentationDriver } from './presentation-driver'
import { PresentationTimeline } from './presentation-timeline'
import { EyeController } from './eye-controller'
import { BreathingController } from './breathing-controller'
import { PresentationCooldown } from './presentation-cooldown'

const CHAT_PHASES = new Set(['listening', 'waiting', 'thinking', 'typing', 'speaking'])

function normalizeEmotionIntensity(value: number | undefined): number {
  if (value === undefined) return 1
  return clampIntensity(value > 1 ? value / 5 : value)
}

function moodToState(mood: CharacterMood): PresentationState {
  if (mood === 'happy') return 'happy'
  if (mood === 'concerned') return 'concerned'
  if (mood === 'tired') return 'tired'
  return 'idle'
}

function layer(source: PresentationSource, name: string, priority: number, intensity: number, curve: PresentationLayerState['curve'], loop: boolean, duration?: number): PresentationLayerState {
  return { source, name, priority, intensity: clampIntensity(intensity), curve, loop, duration, startedAt: duration === undefined ? undefined : Date.now() }
}

export class PresentationEngine {
  private readonly expressions = new ExpressionManager()
  private readonly motions: MotionManager
  private readonly timeline = new PresentationTimeline()
  private readonly eye = new EyeController()
  private readonly breathing = new BreathingController()
  private readonly cooldown = new PresentationCooldown()
  private context: PresentationContext = { characterMood: 'calm', responseAttitude: 'neutral', personalityStyleId: 'default' }
  private state: PresentationState = 'idle'
  private parameters: Record<string, number> = {}
  private readonly systemParameters: Record<SystemParameterSource, Record<string, number>> = { eye_tracking: {}, breathing: {}, voice_lip_sync: {} }
  private voiceLipSyncValue = 0
  private chatPhase: string | undefined
  private debugSnapshot: PresentationSnapshot | null = null
  private modelManifest: ModelManifest | null = null
  private frameId: number | null = null
  private destroyed = false

  constructor(private readonly driver: PresentationDriver, private readonly onChanged: () => void = () => undefined) {
    this.motions = new MotionManager(driver, () => this.changed('system', 'motion_stack'))
    this.syncStableState('system', 'initial')
    if (typeof window !== 'undefined') this.frameId = window.requestAnimationFrame(this.tick)
  }

  setModelManifest(manifest: ModelManifest | null): void {
    this.modelManifest = manifest
    this.eye.configure(manifest?.features?.eyeTracking === false ? undefined : manifest?.eyeTracking)
    this.breathing.configure(manifest?.features?.breathing === false ? undefined : manifest?.breathing)
    if (!this.eye.isEnabled()) {
      this.systemParameters.eye_tracking = {}
      this.driver.clearSystemParameterLayer('eye_tracking')
    }
    if (!this.breathing.isEnabled()) {
      this.systemParameters.breathing = {}
      this.driver.clearSystemParameterLayer('breathing')
    }
    this.voiceLipSyncValue = 0
    this.systemParameters.voice_lip_sync = {}
    this.driver.clearSystemParameterLayer('voice_lip_sync')
    this.motions.refresh()
    this.syncStableState('system', 'model_ready')
  }

  setCharacterMood(mood: CharacterMood | null | undefined): void {
    if (!mood || this.context.characterMood === mood) return
    this.context = { ...this.context, characterMood: mood, event: 'character_state' }
    this.syncStableState('character_mood', 'character_state')
  }

  setUserEmotion(emotion: PetDetectedEmotion | undefined, intensity = 1): void {
    const normalized = emotion ? normalizeEmotionIntensity(intensity) : undefined
    if (this.context.userEmotion === emotion && this.context.userEmotionIntensity === normalized) return
    this.context = { ...this.context, userEmotion: emotion, userEmotionIntensity: normalized, responseAttitude: resolveResponseAttitude(emotion, this.context.characterMood), event: 'emotion_change' }
    this.syncStableState('user_emotion', 'emotion_change')
  }

  setPersonalityStyle(styleId: string | undefined): void {
    const next = styleId?.trim() || 'default'
    if (this.context.personalityStyleId === next) return
    this.context = { ...this.context, personalityStyleId: next }
    this.syncStableState('system', 'personality_style')
  }

  setAffinity(affinity: number | undefined): void {
    this.context = { ...this.context, affinity }
    this.onChanged()
  }

  handleEvent(event: PetEvent): void {
    if (this.destroyed) return
    const payload = event.payload
    if (event.type === 'character_state') {
      this.setCharacterMood(typeof payload.mood === 'string' ? payload.mood as CharacterMood : undefined)
      return
    }
    if (event.type === 'emotion_change') {
      const emotion = typeof payload.emotion === 'string' ? payload.emotion as PetDetectedEmotion : undefined
      this.setUserEmotion(emotion, typeof payload.intensity === 'number' ? payload.intensity : 1)
      return
    }
    if (event.type === 'chat_start') {
      this.setChatPhase('thinking')
      return
    }
    if (event.type === 'chat_phase') {
      this.setChatPhase(typeof payload.phase === 'string' && CHAT_PHASES.has(payload.phase) ? payload.phase : 'thinking')
      return
    }
    if (event.type === 'chat_delta') {
      if (this.chatPhase !== 'speaking') this.setChatPhase('speaking')
      return
    }
    if (event.type === 'chat_complete' || event.type === 'chat_error') {
      this.clearChatLayer(event.type)
      return
    }
    if (event.type === 'voice_start') {
      this.motions.setLayer({ name: 'speaking', priority: 30, intensity: 1, loop: true, source: 'voice', interruptPolicy: 'cancel' })
      this.record('voice', 'voice_start', 'replace')
      if (!this.modelManifest?.features?.lipSync || !this.modelManifest?.lipSync?.parameter) this.record('voice', 'voice_lipsync_fallback', 'fallback')
      this.onChanged()
      return
    }
    if (event.type === 'voice_amplitude') {
      const config = this.modelManifest?.features?.lipSync ? this.modelManifest.lipSync : undefined
      const parameter = config?.parameter
      if (parameter) {
        const value = Math.max(0, Math.min(1, Number(payload.value) || 0)) * (config.range || 1)
        const smoothing = Math.max(0, Math.min(1, config.smoothing ?? 0.25))
        this.voiceLipSyncValue += (value - this.voiceLipSyncValue) * (1 - smoothing)
        this.systemParameters.voice_lip_sync = { [parameter]: this.voiceLipSyncValue }
        this.driver.setSystemParameterLayer('voice_lip_sync', this.systemParameters.voice_lip_sync)
      }
      return
    }
    if (event.type === 'voice_complete' || event.type === 'voice_stop' || event.type === 'voice_error') {
      this.motions.clear('voice')
      this.voiceLipSyncValue = 0
      this.systemParameters.voice_lip_sync = {}
      this.driver.clearSystemParameterLayer('voice_lip_sync')
      this.record('voice', event.type, 'clear')
      this.onChanged()
      return
    }
    if (event.type === 'relationship_up') this.playRelationshipMotion()
    if (event.type === 'interaction') this.interact()
  }

  interact(): void {
    this.motions.setLayer({ name: 'interact', priority: 100, intensity: 1, loop: false, source: 'interaction', interruptPolicy: 'cancel' })
    this.record('interaction', 'interact', 'set')
  }

  updatePointer(clientX: number, clientY: number, width: number, height: number): void {
    this.eye.updatePointer(clientX, clientY, width, height)
    this.applyEyeParameters()
  }

  pointerLeave(): void {
    this.eye.leave()
  }

  debugSetState(state: 'happy' | 'concerned' | 'tired' | 'idle'): void {
    if (state === 'idle') this.resetToIdle()
    else this.setCharacterMood(state)
  }

  debugTestEye(): void {
    this.updatePointer(0, 0, 1, 1)
  }

  debugTestBreathing(): void {
    this.applyBreathingParameters(performance.now())
  }

  async debugSetExpression(name: string, intensity: number, priority: number, curve: IntensityCurve, duration?: number): Promise<void> {
    if (!this.ensureExpression(name)) return
    this.expressions.set(layer('debug', name, priority, intensity, curve, true, duration))
    await this.applyExpressions()
    this.record('debug', 'debug_expression', 'set')
    this.onChanged()
  }

  async debugClearExpression(source: PresentationSource = 'debug'): Promise<void> {
    if (!this.expressions.clear(source)) return
    await this.applyExpressions()
    this.record('debug', `debug_expression_clear:${source}`, 'clear')
    this.onChanged()
  }

  debugPlayMotion(name: string, loop: boolean, intensity: number, priority: number, interruptPolicy: InterruptPolicy): void {
    const fallback = !this.modelManifest?.semanticActions[name]?.length
    this.motions.setLayer({ name, loop, intensity: clampIntensity(intensity), priority, source: 'debug', interruptPolicy })
    this.record('debug', fallback ? `debug_motion_fallback:${name}` : `debug_motion:${name}`, fallback ? 'fallback' : 'set')
    this.onChanged()
  }

  debugQueueMotion(items: MotionQueueItem[]): void {
    if (!items.length) return
    this.motions.enqueue(items.map((item) => ({ ...item, source: 'debug' })))
    this.record('debug', 'debug_motion_queue', 'set')
    this.onChanged()
  }

  debugSetCharacterMood(mood: CharacterMood): void {
    this.setCharacterMood(mood)
  }

  debugSetUserEmotion(emotion: PetDetectedEmotion | undefined, intensity = 1): void {
    this.setUserEmotion(emotion, intensity)
  }

  debugSetChatPhase(phase: ChatPresentationPhase | 'chat_complete' | 'chat_error'): void {
    if (phase === 'chat_complete' || phase === 'chat_error') this.clearChatLayer(phase)
    else this.setChatPhase(phase)
  }

  debugTriggerRelationship(): void {
    this.playRelationshipMotion()
  }

  debugReset(): void {
    this.resetToIdle()
  }

  debugCaptureSnapshot(): PresentationSnapshot {
    this.debugSnapshot = this.captureSnapshot()
    this.record('debug', 'debug_snapshot_capture', 'set')
    this.onChanged()
    return this.debugSnapshot
  }

  debugRestoreSnapshot(): void {
    if (!this.debugSnapshot) {
      this.record('debug', 'debug_snapshot_missing', 'error')
      this.onChanged()
      return
    }
    this.restoreSnapshot(this.debugSnapshot)
  }

  debugClearTimeline(): void {
    this.timeline.clear()
    this.onChanged()
  }

  debugSetSystemEnabled(source: SystemParameterSource, enabled: boolean): void {
    if (source === 'eye_tracking') this.eye.configure(enabled ? this.modelManifest?.eyeTracking : undefined)
    else this.breathing.configure(enabled ? this.modelManifest?.breathing : undefined)
    if (!enabled) {
      this.systemParameters[source] = {}
      this.driver.clearSystemParameterLayer(source)
    }
    this.record('debug', `debug_${source}_${enabled ? 'enabled' : 'disabled'}`, 'replace')
    this.onChanged()
  }

  debugSetEyeTarget(x: number, y: number): void {
    this.eye.updatePointer((x + 1) / 2, (y + 1) / 2, 1, 1)
    this.applyEyeParameters()
    this.onChanged()
  }

  captureSnapshot(): PresentationSnapshot {
    return {
      expressionLayers: this.expressions.snapshot(),
      motionLayers: this.motions.snapshot(),
      motionQueue: this.motions.getQueue(),
      chatPhase: this.chatPhase,
      state: { characterMood: this.context.characterMood, userEmotion: this.context.userEmotion, userEmotionIntensity: this.context.userEmotionIntensity, responseAttitude: this.context.responseAttitude }
    }
  }

  restoreSnapshot(snapshot: PresentationSnapshot): void {
    this.expressions.restore(snapshot)
    this.motions.restore(snapshot)
    this.context = { ...this.context, characterMood: snapshot.state.characterMood, userEmotion: snapshot.state.userEmotion, userEmotionIntensity: snapshot.state.userEmotionIntensity, responseAttitude: snapshot.state.responseAttitude }
    this.state = moodToState(this.context.characterMood)
    this.chatPhase = snapshot.chatPhase
    this.applyExpressions()
    this.record('system', 'snapshot_restore', 'restore')
    this.onChanged()
  }

  resetToIdle(): void {
    this.chatPhase = undefined
    this.motions.clear('chat')
    this.motions.clear('interaction')
    this.motions.clear('relationship')
    this.motions.clear('debug')
    this.expressions.clear('debug')
    this.cooldown.reset()
    this.context = { ...this.context, characterMood: 'calm', userEmotion: undefined, userEmotionIntensity: undefined, responseAttitude: 'neutral', event: 'character_state' }
    this.syncStableState('system', 'debug_reset')
  }

  getDebugSnapshot(): PresentationDebugSnapshot {
    const playback = this.motions.getPlaybackStatus()
    const candidates = playback.name ? this.modelManifest?.semanticActions[playback.name] ?? this.modelManifest?.semanticActions.idle ?? [] : []
    return {
      model: this.modelManifest ? {
        id: this.modelManifest.id,
        name: this.modelManifest.name,
        runtime: this.modelManifest.runtime,
        capabilities: { ...this.modelManifest.capabilities, motions: [...this.modelManifest.capabilities.motions], expressions: [...this.modelManifest.capabilities.expressions] },
        semanticActions: Object.fromEntries(Object.entries(this.modelManifest.semanticActions).map(([name, actions]) => [name, [...actions]])),
        expressionProfiles: Object.fromEntries(Object.entries(this.modelManifest.expressionProfiles ?? {}).map(([name, profile]) => [name, { ...profile, parameters: profile.parameters?.map((parameter) => ({ ...parameter, sourceRange: parameter.sourceRange ? { ...parameter.sourceRange } : undefined })) }])),
        features: { ...(this.modelManifest.features ?? { expression: false, motion: false, physics: false, eyeTracking: false, lipSync: false, breathing: false }) }
      } : null,
      state: this.state,
      context: { ...this.context },
      chatPhase: this.chatPhase,
      expression: this.expressions.getActiveLayer(),
      motion: this.motions.getActiveLayer(),
      expressionLayers: this.expressions.snapshot(),
      motionLayers: this.motions.getLayers(),
      motionQueue: this.motions.getQueue(),
      motionPlayback: {
        ...playback,
        candidates,
        fallback: Boolean(this.modelManifest && playback.name && !this.modelManifest.semanticActions[playback.name]?.length),
        ...(playback.played === false ? { message: '模型未能播放该动作候选，已保留当前表现栈。' } : {})
      },
      systemEnabled: { eye_tracking: this.eye.isEnabled(), breathing: this.breathing.isEnabled(), voice_lip_sync: Boolean(this.modelManifest?.features?.lipSync && this.modelManifest.lipSync?.parameter) },
      systemParameters: { eye_tracking: { ...this.systemParameters.eye_tracking }, breathing: { ...this.systemParameters.breathing }, voice_lip_sync: { ...this.systemParameters.voice_lip_sync } },
      parameters: { ...this.driver.getFinalParameters() },
      timeline: this.timeline.list()
    }
  }

  destroy(): void {
    this.destroyed = true
    if (this.frameId !== null && typeof window !== 'undefined') window.cancelAnimationFrame(this.frameId)
    this.frameId = null
    this.driver.clearSystemParameterLayer('eye_tracking')
    this.driver.clearSystemParameterLayer('breathing')
    this.motions.destroy()
    this.expressions.clearAll()
  }

  private setChatPhase(phase: string): void {
    if (this.chatPhase === phase) return
    this.chatPhase = phase
    const key: PersonalityPresentationKey = phase === 'speaking' ? 'speaking' : phase === 'listening' ? 'listening' : phase === 'waiting' ? 'waiting' : phase === 'typing' ? 'typing' : 'thinking'
    const presentation = resolvePersonalityPresentation(this.context.personalityStyleId, key)
    this.motions.setLayer({ name: presentation.motion || 'idle', priority: 20, intensity: 1, loop: true, source: 'chat', interruptPolicy: 'cancel' })
    this.record('chat', phase, 'replace')
  }

  private clearChatLayer(event: string): void {
    this.chatPhase = undefined
    this.motions.clear('chat')
    this.expressions.clear('chat')
    this.applyExpressions()
    this.record('chat', event, 'clear')
    this.onChanged()
  }

  private playRelationshipMotion(): void {
    const presentation = resolvePersonalityPresentation(this.context.personalityStyleId, 'celebrate')
    const item: MotionQueueItem = { name: presentation.motion || 'interact', priority: 80, intensity: 1, loop: false, source: 'relationship', interruptPolicy: 'pause' }
    this.motions.setLayer(item)
    if (presentation.motionQueue?.length) this.motions.enqueue(presentation.motionQueue.map((queued) => ({ ...queued, priority: 80, intensity: 1, source: 'relationship', interruptPolicy: 'queue' })))
    this.record('relationship', item.name, 'set')
  }

  private syncStableState(source: PresentationSource, event: string): void {
    this.state = moodToState(this.context.characterMood)
    const characterPresentation = resolvePersonalityPresentation(this.context.personalityStyleId, this.context.characterMood)
    this.cooldown.shouldRestart(`${this.context.personalityStyleId}:${this.context.characterMood}:${characterPresentation.expression || ''}:${characterPresentation.motion || 'idle'}`)
    if (characterPresentation.expression) this.expressions.set(layer('character_mood', characterPresentation.expression, 50, 0.65, characterPresentation.curve, true))
    else this.expressions.clear('character_mood')
    if (this.context.userEmotion) {
      const userPresentation = resolvePersonalityPresentation(this.context.personalityStyleId, this.context.responseAttitude)
      if (userPresentation.expression) this.expressions.set(layer('user_emotion', userPresentation.expression, 50, this.context.userEmotionIntensity ?? 1, userPresentation.curve, true))
    } else this.expressions.clear('user_emotion')
    this.motions.setLayer({ name: characterPresentation.motion || 'idle', priority: 0, intensity: 1, loop: true, source: 'system', interruptPolicy: 'cancel' })
    this.applyExpressions()
    this.record(source, event, 'replace')
    this.onChanged()
  }

  private async applyExpressions(): Promise<void> {
    await this.driver.applyExpressionLayers(this.expressions.getLayers()).then((parameters) => {
      this.parameters = parameters
      this.onChanged()
    }).catch(() => undefined)
  }

  private applyEyeParameters(): void {
    if (!this.eye.isEnabled()) return
    this.systemParameters.eye_tracking = this.eye.step()
    this.driver.setSystemParameterLayer('eye_tracking', this.systemParameters.eye_tracking)
  }

  private applyBreathingParameters(now: number): void {
    if (!this.breathing.isEnabled()) return
    this.systemParameters.breathing = this.breathing.step(now)
    this.driver.setSystemParameterLayer('breathing', this.systemParameters.breathing)
  }

  private readonly tick = (now: number): void => {
    if (this.destroyed) return
    const expired = this.expressions.expire()
    if (expired.length) {
      this.applyExpressions()
      this.record('system', 'expression_expired', 'clear')
      this.onChanged()
    }
    this.applyEyeParameters()
    this.applyBreathingParameters(now)
    this.parameters = this.driver.getFinalParameters()
    this.frameId = typeof window === 'undefined' ? null : window.requestAnimationFrame(this.tick)
  }

  private record(source: PresentationSource, event: string, action: 'set' | 'replace' | 'clear' | 'restore' | 'fallback' | 'error'): void {
    const expression = this.expressions.getActiveLayer()
    const motion = this.motions.getActiveLayer()
    this.timeline.push({
      event,
      source,
      state: this.state,
      action,
      expression: expression?.name,
      motion: motion?.name,
      intensity: expression?.intensity ?? motion?.intensity,
      priority: expression?.priority ?? motion?.priority,
      layers: [...this.expressions.getLayers(), ...this.motions.getLayers()],
      parameters: { ...this.parameters }
    })
  }

  private changed(source: PresentationSource, event: string): void {
    this.record(source, event, 'replace')
    this.onChanged()
  }

  private ensureExpression(name: string): boolean {
    if (this.modelManifest?.expressionProfiles?.[name]) return true
    this.record('debug', `debug_expression_missing:${name}`, 'error')
    this.onChanged()
    return false
  }
}



