<template>
  <main ref="shellRef" class="pet-shell" :class="{ 'is-menu-open': menuOpen }" @pointermove="trackPointer" @pointerleave="handlePointerLeave" @pointerdown="handleShellPointerDown" @contextmenu.prevent="handleShellContextMenu">
    <section class="pet-model-zone" :style="modelZoneStyle" @pointerdown="beginDrag" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag" @wheel="handleWheel" @contextmenu.prevent="openContextMenu">
      <section v-if="bubble.visible" class="pet-bubble" @pointerdown.stop @contextmenu.stop>
        <span class="bubble-label">{{ character.name || '伙伴' }}</span>
        <p>{{ bubble.content }}</p>
        <span v-if="bubble.streaming" class="bubble-streaming">正在回复…</span>
      </section>
      <div ref="stageRef" class="pet-stage" :class="{ 'is-hidden': fallbackVisible }" />
      <div v-if="fallbackVisible" class="pet-fallback" :title="fallbackMessage">
        <img v-if="character.avatarUrl && !avatarFailed" ref="fallbackVisualRef" :src="resolveAvatarUrl(character.avatarUrl)" :alt="`${character.name}的头像`" @error="avatarFailed = true" />
        <span v-else ref="fallbackVisualRef">{{ character.name[0] || '艾' }}</span>
        <small>{{ fallbackMessage }}</small>
      </div>
    </section>

    <aside v-if="menuOpen" class="pet-menu" :class="[`is-${layout.menuSide}`, { 'has-debug': debugEnabled && !debugCollapsed }]" :style="menuStyle" @pointerdown.stop @click.stop @contextmenu.prevent>
      <header class="pet-menu-header"><span>桌宠操作</span><strong>{{ character.name || '伙伴' }}</strong></header>
      <button type="button" class="pet-menu-item" @click="openChatFromMenu"><span>对话</span><small>打开主聊天窗口</small></button>
      <button type="button" class="pet-menu-item" @click="voicePanelOpen = !voicePanelOpen"><span>语音</span><small>{{ voiceStatus === 'playing' ? '正在朗读' : voiceStatus === 'error' ? '播放失败' : `自动朗读${voiceAutoPlay ? '已开启' : '已关闭'}` }}</small></button>
      <section v-if="voicePanelOpen" class="pet-voice-controls">
        <span>状态：{{ voiceStatusLabel }}</span>
        <span>Provider：{{ voiceProviderReady === false ? '未配置，文字聊天不受影响' : voiceProviderReady === true ? '已配置' : '检查中' }}</span>
        <button type="button" :disabled="voiceStatus !== 'playing'" @click="stopVoiceFromPet">停止朗读</button>
        <button type="button" @click="openChatFromVoice">打开聊天</button>
      </section>
      <button type="button" class="pet-menu-item" @click="showComingSoon('听歌')"><span>听歌</span><small>功能筹备中</small></button>
      <button v-if="debugEnabled" type="button" class="pet-menu-item pet-debug-menu-item" :aria-expanded="!debugCollapsed" @click="debugCollapsed = !debugCollapsed"><span>表现调试</span><small>{{ debugCollapsed ? '打开 Live2D 测试面板' : '收起测试面板' }}</small></button>
      <section class="pet-menu-scale">
        <button type="button" class="pet-menu-item" :aria-expanded="scaleExpanded" @click="toggleScaleControls"><span>缩放</span><small>{{ Math.round(config.scale * 100) }}%</small></button>
        <div v-if="scaleExpanded" class="pet-scale-controls">
          <input :value="config.scale" type="range" min="0.6" max="1.5" step="0.05" aria-label="桌宠缩放" @input="setScaleFromInput" />
          <div class="pet-scale-buttons"><button type="button" @click="adjustScale(-0.1)">缩小</button><button type="button" @click="resetScale">重置</button><button type="button" @click="adjustScale(0.1)">放大</button></div>
        </div>
      </section>
      <section class="pet-more-settings">
        <button type="button" class="pet-more-toggle" :aria-expanded="moreSettingsOpen" @click="toggleMoreSettings">更多设置</button>
        <div v-if="moreSettingsOpen" class="pet-more-controls">
          <label><input v-model="config.alwaysOnTop" type="checkbox" @change="saveConfig({ alwaysOnTop: config.alwaysOnTop })" /> 始终置顶</label>
          <button type="button" @click="resetPosition">重置位置</button>
          <button type="button" @click="hidePet">隐藏桌宠</button>
        </div>
      </section>
      <p v-if="menuFeedback" class="pet-menu-feedback" role="status">{{ menuFeedback }}</p>

    <aside v-if="debugEnabled && presentationDebug && !debugCollapsed" class="pet-debug" @pointerdown.stop @click.stop @wheel.stop @contextmenu.stop>
      <header class="pet-debug-header"><div><strong>Presentation Lab</strong><small>仅内存调试，不触发业务事件</small><small v-if="debugBusy">执行中：{{ debugBusy }}</small></div><button type="button" title="收起面板" @click="debugCollapsed = true">收起</button></header>
      <section class="debug-section"><h3>当前状态</h3><dl><dt>模型</dt><dd>{{ presentationDebug.model?.name || '未加载' }}</dd><dt>ID / Runtime</dt><dd>{{ presentationDebug.model?.id || '—' }} / {{ presentationDebug.model?.runtime || '—' }}</dd><dt>状态</dt><dd>{{ presentationDebug.state }} · {{ presentationDebug.chatPhase || 'stable' }}</dd><dt>上下文</dt><dd>{{ presentationDebug.context.characterMood }} / {{ presentationDebug.context.userEmotion || '—' }} ({{ (presentationDebug.context.userEmotionIntensity ?? 0).toFixed(2) }})</dd><dt>态度 / 人格</dt><dd>{{ presentationDebug.context.responseAttitude }} / {{ presentationDebug.context.personalityStyleId }}</dd><dt>表达</dt><dd>{{ presentationDebug.expression?.name || '—' }} · {{ presentationDebug.expression?.intensity.toFixed(2) || '—' }} · P{{ presentationDebug.expression?.priority ?? '—' }}</dd><dt>动作</dt><dd>{{ presentationDebug.motion?.name || '—' }} {{ presentationDebug.motion?.loop ? '↻' : '' }} · P{{ presentationDebug.motion?.priority ?? '—' }}</dd></dl><p class="debug-muted">能力：{{ Object.keys(presentationDebug.model?.semanticActions || {}).join(', ') || '—' }} · expression {{ presentationDebug.model?.features.expression ? 'on' : 'off' }} · motion {{ presentationDebug.model?.features.motion ? 'on' : 'off' }} · eye {{ presentationDebug.model?.features.eyeTracking ? 'on' : 'off' }} · breathing {{ presentationDebug.model?.features.breathing ? 'on' : 'off' }}</p></section>

      <section class="debug-section"><h3>快速情绪</h3><div class="debug-grid"><button v-for="mood in moods" :key="mood" type="button" @click="runDebug(`mood:${mood}`, () => presentation?.debugSetCharacterMood(mood))">{{ mood }}</button><button type="button" @click="runDebug('idle', () => presentation?.debugReset())">恢复 idle</button></div><div class="debug-inline"><select v-model="debugUserEmotion"><option v-for="emotion in emotions" :key="emotion" :value="emotion">用户 {{ emotion }}</option></select><input v-model.number="debugUserIntensity" type="range" min="0" max="1" step="0.05" /><output>{{ debugUserIntensity.toFixed(2) }}</output><button type="button" @click="runDebug('user-emotion', () => presentation?.debugSetUserEmotion(debugUserEmotion, debugUserIntensity))">应用</button><button type="button" @click="runDebug('clear-user-emotion', () => presentation?.debugSetUserEmotion(undefined))">清除用户层</button></div></section>

      <section class="debug-section"><h3>表情测试</h3><p v-if="!Object.keys(presentationDebug.model?.expressionProfiles || {}).length" class="debug-muted">该模型未提供参数表情配置</p><div v-else class="debug-grid"><button v-for="name in Object.keys(presentationDebug.model?.expressionProfiles || {})" :key="name" type="button" @click="runDebug(`expression:${name}`, () => presentation?.debugSetExpression(name, debugExpressionIntensity, debugExpressionPriority, debugExpressionCurve, debugExpressionDuration || undefined))">{{ name }}</button></div><div class="debug-form"><label>强度 <input v-model.number="debugExpressionIntensity" type="range" min="0" max="1" step="0.05" /><output>{{ debugExpressionIntensity.toFixed(2) }}</output></label><label>优先级 <input v-model.number="debugExpressionPriority" type="number" min="0" max="200" /></label><label>曲线 <select v-model="debugExpressionCurve"><option v-for="curve in curves" :key="curve" :value="curve">{{ curve }}</option></select></label><label>持续 ms <input v-model.number="debugExpressionDuration" type="number" min="0" step="100" placeholder="持续" /></label><label>清除层 <select v-model="debugExpressionSource"><option v-for="source in expressionSources" :key="source" :value="source">{{ source }}</option></select></label><button type="button" @click="runDebug('clear-expression', () => presentation?.debugClearExpression(debugExpressionSource))">清除表达式层</button></div></section>

      <section class="debug-section"><h3>动作测试</h3><div class="debug-grid"><button v-for="action in actionNames" :key="action" type="button" @click="runDebug(`motion:${action}`, () => presentation?.debugPlayMotion(action, debugMotionLoop, debugMotionIntensity, debugMotionPriority, debugInterruptPolicy))">{{ action }}</button></div><div class="debug-form"><label>循环 <input v-model="debugMotionLoop" type="checkbox" /></label><label>强度 <input v-model.number="debugMotionIntensity" type="range" min="0" max="1" step="0.05" /><output>{{ debugMotionIntensity.toFixed(2) }}</output></label><label>优先级 <input v-model.number="debugMotionPriority" type="number" min="0" max="200" /></label><label>策略 <select v-model="debugInterruptPolicy"><option v-for="policy in interruptPolicies" :key="policy" :value="policy">{{ policy }}</option></select></label></div><p class="debug-muted">候选：{{ presentationDebug.motionPlayback.candidates.join(', ') || '—' }}<span v-if="presentationDebug.motionPlayback.fallback"> · fallback 到 idle</span><span v-if="presentationDebug.motionPlayback.message"> · {{ presentationDebug.motionPlayback.message }}</span></p><div class="debug-grid"><button v-for="action in quickActions" :key="`quick-${action}`" type="button" @click="runDebug(`quick:${action}`, () => presentation?.debugPlayMotion(action, false, 1, 80, 'cancel'))">测试 {{ action }}</button></div></section>

      <section class="debug-section"><h3>动作队列</h3><div class="debug-inline"><select v-model="queueAction"><option v-for="action in actionNames" :key="action" :value="action">{{ action }}</option></select><button type="button" @click="addQueueItem">加入队列</button><button type="button" @click="playDebugQueue">立即播放</button><button type="button" @click="debugQueue = []">清空</button></div><ul class="debug-list"><li v-for="(item, index) in debugQueue" :key="`${item.name}-${index}`">{{ item.name }} · {{ item.loop ? 'loop' : 'once' }} · {{ item.interruptPolicy }}<button type="button" @click="debugQueue.splice(index, 1)">删除</button></li><li v-if="!debugQueue.length" class="debug-muted">暂无排队动作</li></ul><p class="debug-muted">当前：{{ presentationDebug.motion?.name || '—' }} · 排队：{{ presentationDebug.motionQueue.length }} · 恢复目标：{{ presentationDebug.motionLayers.find((item) => item.source !== 'debug')?.name || 'idle' }} · 播放结果：{{ presentationDebug.motionPlayback.played === false ? '失败' : '可用' }}</p></section>

      <section class="debug-section"><h3>聊天阶段模拟</h3><div class="debug-grid"><button v-for="phase in chatPhases" :key="phase" type="button" @click="runDebug(`phase:${phase}`, () => presentation?.debugSetChatPhase(phase))">{{ phase }}</button></div><div class="debug-grid"><button type="button" @click="runDebug('relationship', () => presentation?.debugTriggerRelationship())">测试 relationship</button><button type="button" @click="runDebug('chat-complete', () => presentation?.debugSetChatPhase('chat_complete'))">chat_complete</button><button type="button" @click="runDebug('chat-error', () => presentation?.debugSetChatPhase('chat_error'))">chat_error</button></div></section>

      <section class="debug-section"><h3>系统表现</h3><div class="debug-inline"><label><input :checked="presentationDebug.systemEnabled.eye_tracking" type="checkbox" :disabled="!presentationDebug.model?.features.eyeTracking" @change="toggleSystem('eye_tracking', $event)" /> Eye Tracking</label><button v-for="point in eyePoints" :key="point.label" type="button" :disabled="!presentationDebug.systemEnabled.eye_tracking" @click="runDebug(`eye:${point.label}`, () => presentation?.debugSetEyeTarget(point.x, point.y))">{{ point.label }}</button></div><code>{{ formatParameters(presentationDebug.systemParameters.eye_tracking) }}</code><div class="debug-inline"><label><input type="checkbox" :checked="presentationDebug.systemEnabled.breathing" :disabled="!presentationDebug.model?.features.breathing" @change="toggleSystem('breathing', $event)" /> Breathing</label></div><code>{{ formatParameters(presentationDebug.systemParameters.breathing) }}</code></section>

      <section class="debug-section"><h3>快照与恢复</h3><div class="debug-grid"><button type="button" @click="runDebug('snapshot-capture', () => presentation?.debugCaptureSnapshot())">保存快照</button><button type="button" @click="runDebug('snapshot-restore', () => presentation?.debugRestoreSnapshot())">恢复快照</button><button type="button" @click="runDebug('reset', () => presentation?.debugReset())">全部恢复 idle</button></div></section>

      <section class="debug-section"><div class="debug-section-title"><h3>Timeline ({{ presentationDebug.timeline.length }})</h3><button type="button" @click="presentation?.debugClearTimeline(); refreshDebug()">清空</button></div><div class="debug-timeline"><code v-for="entry in presentationDebug.timeline" :key="`${entry.timestamp}-${entry.event}-${entry.action}`">{{ formatTimeline(entry.timestamp) }} {{ entry.action }} · {{ entry.source }} · {{ entry.event }}<br />{{ entry.expression || '—' }} / {{ entry.motion || '—' }} · P{{ entry.priority ?? '—' }} · {{ entry.intensity?.toFixed(2) || '—' }}</code></div><details open><summary>最终参数 / fallback</summary><code v-for="(value, name) in presentationDebug.parameters" :key="name">{{ name }}: {{ Number(value).toFixed(3) }}</code><code v-if="!Object.keys(presentationDebug.parameters).length">无最终参数</code></details></section>
    </aside>
    </aside>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { resolveAvatarUrl } from '@/utils/avatar'
import { apiUrl } from '@/services/api-base'
import { Live2DManager } from '@/live2d/live2d-manager'
import { getCharacterAppearance } from '@/live2d/character-appearance'
import { PixiLive2DRendererAdapter } from '@/live2d/pixi-live2d-renderer-adapter'
import { PresentationEngine } from '@/live2d/presentation/presentation-engine'
import type { CharacterMood, InterruptPolicy, MotionQueueItem, PetConfig, PetDetectedEmotion, PetEvent, PetSnapshot, PetWindowLayout, PresentationDebugSnapshot, ResolvedPetModel } from '@/live2d/live2d.types'

interface CharacterPresentation {
  id: string
  name: string
  avatarUrl?: string
  appearance?: { modelId?: string, presentationStyleId?: string }
}

interface CursorPosition {
  x: number
  y: number
  width: number
  height: number
  inside: boolean
}

const debugQuery = new URLSearchParams(`${window.location.search.replace(/^\?/, '')}&${window.location.hash.split('?')[1] || ''}`)
const debugEnabled = import.meta.env.DEV && debugQuery.get('debug') === '1'
const shellRef = ref<HTMLElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const fallbackVisualRef = ref<HTMLElement | null>(null)
const menuOpen = ref(false)
const scaleExpanded = ref(false)
const moreSettingsOpen = ref(false)
const menuFeedback = ref('')
const voicePanelOpen = ref(false)
const voiceStatus = ref<'idle' | 'playing' | 'error'>('idle')
const voiceAutoPlay = ref(true)
const voiceProviderReady = ref<boolean | null>(null)
const fallbackVisible = ref(true)
const fallbackMessage = ref('正在加载角色形象')
const avatarFailed = ref(false)
const presentationDebug = ref<PresentationDebugSnapshot | null>(null)
const debugCollapsed = ref(true)
const debugBusy = ref('')
const debugUserEmotion = ref<PetDetectedEmotion>('calm')
const debugUserIntensity = ref(0.6)
const debugExpressionIntensity = ref(0.8)
const debugExpressionPriority = ref(60)
const debugExpressionCurve = ref<'linear' | 'easeIn' | 'easeOut' | 'soft'>('soft')
const debugExpressionDuration = ref(0)
const debugExpressionSource = ref<'debug' | 'character_mood' | 'user_emotion' | 'chat'>('debug')
const debugMotionLoop = ref(false)
const debugMotionIntensity = ref(1)
const debugMotionPriority = ref(80)
const debugInterruptPolicy = ref<InterruptPolicy>('cancel')
const debugQueue = ref<MotionQueueItem[]>([])
const queueAction = ref('idle')
const config = reactive<PetConfig>({ enabled: true, modelId: 'hiyori_free', scale: 1, position: null, alwaysOnTop: true, disabledModelIds: [] })
const layout = reactive<PetWindowLayout>({ menuOpen: false, menuSide: 'left', modelWidth: 460, modelHeight: 620, menuWidth: 252, menuHeight: 520, menuGap: 6, shellWidth: 718, shellHeight: 620 })
const character = reactive<CharacterPresentation>({ id: '', name: '伙伴' })
const bubble = reactive({ visible: false, content: '', streaming: false })
const moods: CharacterMood[] = ['happy', 'concerned', 'tired', 'calm']
const emotions: PetDetectedEmotion[] = ['happy', 'calm', 'anxious', 'sad', 'angry', 'tired']
const curves = ['linear', 'easeIn', 'easeOut', 'soft'] as const
const interruptPolicies: InterruptPolicy[] = ['cancel', 'pause', 'queue', 'ignore']
const chatPhases = ['listening', 'waiting', 'thinking', 'typing', 'speaking'] as const
const quickActions = ['interact', 'idle', 'thinking', 'speaking']
const expressionSources = ['debug', 'character_mood', 'user_emotion', 'chat'] as const
const eyePoints = [{ label: '左', x: -1, y: 0 }, { label: '中心', x: 0, y: 0 }, { label: '右', x: 1, y: 0 }, { label: '上', x: 0, y: -1 }, { label: '下', x: 0, y: 1 }]
const actionNames = computed(() => Object.keys(presentationDebug.value?.model?.semanticActions ?? {}))
const voiceStatusLabel = computed(() => voiceStatus.value === 'playing' ? '正在朗读' : voiceStatus.value === 'error' ? '播放失败' : '待机')

const PET_MENU_BASE_WIDTH = 252
const PET_MENU_BASE_HEIGHT = 520
const PET_MENU_MODEL_ANCHOR_RATIO = 0.34
const modelZoneStyle = computed(() => ({ width: `${layout.modelWidth}px`, height: `${layout.modelHeight}px`, left: layout.menuSide === 'left' ? `${layout.menuWidth + layout.menuGap}px` : '0px' }))
const menuStyle = computed(() => {
  const leftMenuRightEdge = layout.menuWidth + layout.menuGap + layout.modelWidth * PET_MENU_MODEL_ANCHOR_RATIO
  return { width: `${PET_MENU_BASE_WIDTH}px`, minHeight: `${PET_MENU_BASE_HEIGHT}px`, left: layout.menuSide === 'left' ? `${Math.round(leftMenuRightEdge - PET_MENU_BASE_WIDTH)}px` : `${layout.modelWidth + layout.menuGap}px` }
})

let manager: Live2DManager | null = null
let presentation: PresentationEngine | null = null
let removeEventListener: (() => void) | undefined
let removeConfigListener: (() => void) | undefined
let removeLayoutListener: (() => void) | undefined
let removeCursorListener: (() => void) | undefined
let bubbleTimer: number | null = null
let feedbackTimer: number | null = null
let dragPointerId: number | null = null
let dragLastPoint: { x: number, y: number } | null = null
let dragMoved = false
let inputCaptured = false
let runtimeReady = false

function refreshDebug(): void { if (debugEnabled) presentationDebug.value = presentation?.getDebugSnapshot() ?? null }
async function runDebug(label: string, action: () => unknown): Promise<void> {
  if (debugBusy.value) return
  debugBusy.value = label
  try { await action() } finally { debugBusy.value = ''; refreshDebug() }
}
function addQueueItem(): void {
  debugQueue.value.push({ name: queueAction.value, priority: debugMotionPriority.value, intensity: debugMotionIntensity.value, loop: debugMotionLoop.value, source: 'debug', interruptPolicy: debugInterruptPolicy.value })
}
function playDebugQueue(): void {
  const items = debugQueue.value.slice()
  if (!items.length) return
  const [first, ...rest] = items
  void runDebug('queue-play', () => {
    presentation?.debugPlayMotion(first.name, first.loop, first.intensity, first.priority, first.interruptPolicy)
    if (rest.length) presentation?.debugQueueMotion(rest)
    debugQueue.value = []
  })
}
function toggleSystem(source: 'eye_tracking' | 'breathing', event: Event): void {
  const enabled = (event.target as HTMLInputElement).checked
  void runDebug(`${source}:${enabled}`, () => presentation?.debugSetSystemEnabled(source, enabled))
}
function formatParameters(parameters: Record<string, number>): string { return Object.entries(parameters).map(([name, value]) => `${name}=${value.toFixed(3)}`).join(' · ') || '暂无参数写入' }
function applyConfig(nextConfig: PetConfig): void { Object.assign(config, nextConfig) }
function applyLayout(nextLayout: PetWindowLayout): void { Object.assign(layout, nextLayout); menuOpen.value = nextLayout.menuOpen; if (!nextLayout.menuOpen) { scaleExpanded.value = false; moreSettingsOpen.value = false } }
function logPetError(stage: string, error: unknown): void {
  const detail = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack || ''}` : String(error)
  console.error(`[Pet] ${stage}: ${detail}`)
}

function loadRuntimeScript(url: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-live2d-runtime="${key}"]`)
    if (existing) {
      if (existing.dataset.loaded === 'true') resolve()
      else { existing.addEventListener('load', () => resolve(), { once: true }); existing.addEventListener('error', () => reject(new Error(`${key} 运行时加载失败`)), { once: true }) }
      return
    }
    const script = document.createElement('script')
    script.src = url
    script.dataset.live2dRuntime = key
    script.onload = () => { script.dataset.loaded = 'true'; resolve() }
    script.onerror = () => reject(new Error(`${key} 运行时加载失败`))
    document.head.appendChild(script)
  })
}

async function ensureRuntime(): Promise<void> {
  if (runtimeReady) return
  const api = window.electronAPI
  if (!api) throw new Error('Live2D 桌宠仅支持 Electron 桌面端')
  const [coreUrl, runtimeUrls] = await Promise.all([api.getLive2DCoreUrl(), api.getLive2DRuntimeUrls()])
  await loadRuntimeScript(coreUrl, 'cubism-core')
  await loadRuntimeScript(runtimeUrls.pixi, 'pixi')
  await loadRuntimeScript(runtimeUrls.unsafeEval, 'pixi-unsafe-eval')
  await loadRuntimeScript(runtimeUrls.plugin, 'pixi-live2d-cubism4')
  const globalWindow = window as Window & { Live2DCubismCore?: unknown, PIXI?: { Ticker?: unknown, live2d?: { Live2DModel?: { registerTicker?: (ticker: unknown) => void } } } }
  if (!globalWindow.Live2DCubismCore || !globalWindow.PIXI?.live2d?.Live2DModel) throw new Error('Live2D 运行时初始化失败')
  if (globalWindow.PIXI.Ticker && globalWindow.PIXI.live2d.Live2DModel.registerTicker) globalWindow.PIXI.live2d.Live2DModel.registerTicker(globalWindow.PIXI.Ticker)
  runtimeReady = true
}

async function loadResolvedModel(): Promise<void> {
  const api = window.electronAPI
  if (!api || !manager) return
  fallbackVisible.value = true
  fallbackMessage.value = '正在加载角色形象'
  const appearance = getCharacterAppearance(character, config.modelId)
  const resolved = await api.getPetModel(appearance.modelId || undefined) as ResolvedPetModel | null
  if (!resolved) {
    presentation?.setModelManifest(null)
    fallbackVisible.value = true
    fallbackMessage.value = '没有可用的角色形象'
    refreshDebug()
    return
  }
  try {
    await manager.changeModel(resolved)
    presentation?.setModelManifest(resolved.manifest)
    fallbackVisible.value = false
  } catch (error) {
    logPetError('模型加载失败', error)
    presentation?.setModelManifest(null)
    fallbackVisible.value = true
    fallbackMessage.value = error instanceof Error ? `模型加载失败：${error.message}` : '模型加载失败，已使用头像显示'
  }
  refreshDebug()
}

function clearBubbleTimer(): void { if (bubbleTimer !== null) window.clearTimeout(bubbleTimer); bubbleTimer = null }
function hideBubbleLater(): void { clearBubbleTimer(); bubbleTimer = window.setTimeout(() => { bubble.visible = false; bubble.streaming = false }, 15_000) }

function handlePetEvent(rawEvent: unknown): void {
  const event = rawEvent as PetEvent
  if (!event || typeof event.type !== 'string' || !event.payload) return
  if (event.type === 'voice_start') voiceStatus.value = 'playing'
  if (event.type === 'voice_complete' || event.type === 'voice_stop') voiceStatus.value = 'idle'
  if (event.type === 'voice_error' || event.type === 'voice_fallback') voiceStatus.value = 'error'
  if (event.type === 'character_changed') {
    const payload = event.payload as Partial<CharacterPresentation>
    character.id = typeof payload.id === 'string' ? payload.id : ''
    character.name = typeof payload.name === 'string' && payload.name.trim() ? payload.name : '伙伴'
    character.avatarUrl = typeof payload.avatarUrl === 'string' ? payload.avatarUrl : undefined
    character.appearance = payload.appearance && typeof payload.appearance === 'object' ? payload.appearance : undefined
    avatarFailed.value = false
    presentation?.setPersonalityStyle(character.appearance?.presentationStyleId)
    void loadResolvedModel()
    return
  }
  presentation?.handleEvent(event)
  if (event.type === 'chat_start') {
    clearBubbleTimer(); bubble.visible = true; bubble.streaming = true; bubble.content = '我在认真想一想…'
  } else if (event.type === 'chat_delta') {
    const content = typeof event.payload.content === 'string' ? event.payload.content.slice(0, 4_000) : ''
    if (content) { bubble.visible = true; bubble.streaming = true; bubble.content = content }
  } else if (event.type === 'chat_complete') {
    bubble.streaming = false; hideBubbleLater()
  } else if (event.type === 'chat_error') {
    bubble.visible = true; bubble.streaming = false; bubble.content = '刚才的回复没有完成，请在聊天窗口重试。'; hideBubbleLater()
  }
  refreshDebug()
}

async function saveConfig(patch: Partial<PetConfig>): Promise<void> { const next = await window.electronAPI?.updatePetConfig(patch); if (next) applyConfig(next as PetConfig) }
function adjustScale(delta: number): void { void saveConfig({ scale: Math.min(1.5, Math.max(0.6, Number((config.scale + delta).toFixed(2)))) }) }
function setScaleFromInput(event: Event): void { const value = Number((event.target as HTMLInputElement).value); if (Number.isFinite(value)) void saveConfig({ scale: value }) }
function resetScale(): void { void saveConfig({ scale: 1 }) }
async function resetPosition(): Promise<void> { await window.electronAPI?.resetPetPosition(); await closeMenu() }
async function openChatFromMenu(): Promise<void> { await window.electronAPI?.openChatFromPet(); await closeMenu() }
function stopVoiceFromPet(): void { void window.electronAPI?.voiceControl('stop') }
function openChatFromVoice(): void { void window.electronAPI?.voiceControl('open-chat') }
async function hidePet(): Promise<void> { await window.electronAPI?.hidePet() }
function showComingSoon(name: string): void { if (feedbackTimer !== null) window.clearTimeout(feedbackTimer); menuFeedback.value = `${name}功能筹备中，当前不会启动音频或修改聊天数据。`; feedbackTimer = window.setTimeout(() => { menuFeedback.value = '' }, 2_800) }
function toggleScaleControls(): void { scaleExpanded.value = !scaleExpanded.value; if (scaleExpanded.value) moreSettingsOpen.value = false }
function toggleMoreSettings(): void { moreSettingsOpen.value = !moreSettingsOpen.value; if (moreSettingsOpen.value) scaleExpanded.value = false }

function isFallbackHit(event: PointerEvent | MouseEvent | WheelEvent): boolean {
  const element = fallbackVisualRef.value
  if (!fallbackVisible.value || !element) return false
  const rect = element.getBoundingClientRect(); const radius = Math.min(rect.width, rect.height) / 2
  const x = event.clientX - (rect.left + rect.width / 2); const y = event.clientY - (rect.top + rect.height / 2)
  return x * x + y * y <= radius * radius
}
function isModelHit(event: PointerEvent | MouseEvent | WheelEvent): boolean { return fallbackVisible.value ? isFallbackHit(event) : manager?.isHitAt(event.clientX, event.clientY) === true }
function shouldCapturePointer(event: PointerEvent): boolean { if (menuOpen.value) return true; const target = event.target as HTMLElement; return Boolean(target.closest('.pet-bubble')) || isModelHit(event) }
function setInputCapture(enabled: boolean): void { if (inputCaptured === enabled) return; inputCaptured = enabled; void window.electronAPI?.setPetInputCapture(enabled) }
function updatePresentationPointer(clientX: number, clientY: number): void { const stage = stageRef.value; if (!stage) return; const rect = stage.getBoundingClientRect(); presentation?.updatePointer(clientX - rect.left, clientY - rect.top, rect.width, rect.height) }
function trackPointer(event: PointerEvent): void { setInputCapture(shouldCapturePointer(event)); updatePresentationPointer(event.clientX, event.clientY) }
function handlePointerLeave(): void { presentation?.pointerLeave(); setInputCapture(false) }
function handleCursorPosition(position: unknown): void { const value = position as CursorPosition; if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return; if (!value.inside) { presentation?.pointerLeave(); return }; updatePresentationPointer(value.x, value.y) }
function handleShellPointerDown(event: PointerEvent): void { if (!menuOpen.value) return; const target = event.target as HTMLElement; if (!target.closest('.pet-menu')) void closeMenu() }
function handleShellContextMenu(event: MouseEvent): void { if (menuOpen.value && !(event.target as HTMLElement).closest('.pet-menu')) void closeMenu() }
async function openContextMenu(event: MouseEvent): Promise<void> { if (!isModelHit(event)) return; const nextLayout = await window.electronAPI?.openPetActionMenu(); if (nextLayout) applyLayout(nextLayout as PetWindowLayout); inputCaptured = true }
async function closeMenu(): Promise<void> { if (!menuOpen.value) return; const nextLayout = await window.electronAPI?.closePetActionMenu(); if (nextLayout) applyLayout(nextLayout as PetWindowLayout); inputCaptured = false }
function beginDrag(event: PointerEvent): void { if (event.button !== 0 || menuOpen.value || !isModelHit(event)) return; dragPointerId = event.pointerId; dragLastPoint = { x: event.screenX, y: event.screenY }; dragMoved = false; (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId) }
function moveDrag(event: PointerEvent): void { if (dragPointerId !== event.pointerId || !dragLastPoint) return; const deltaX = event.screenX - dragLastPoint.x; const deltaY = event.screenY - dragLastPoint.y; if (Math.abs(deltaX) + Math.abs(deltaY) > 1) { dragMoved = true; void window.electronAPI?.movePetBy(deltaX, deltaY); dragLastPoint = { x: event.screenX, y: event.screenY } } }
function endDrag(event: PointerEvent): void { if (dragPointerId !== event.pointerId) return; const moved = dragMoved; dragPointerId = null; dragLastPoint = null; if (!moved) { presentation?.interact(); refreshDebug() } }
function handleWheel(event: WheelEvent): void { if (!event.ctrlKey || !isModelHit(event)) return; event.preventDefault(); adjustScale(event.deltaY > 0 ? -0.05 : 0.05) }
function handleKeydown(event: KeyboardEvent): void { if (event.key === 'Escape') void closeMenu() }
function debugState(state: 'happy' | 'concerned' | 'tired' | 'idle'): void { presentation?.debugSetState(state); refreshDebug() }
function debugTap(): void { presentation?.interact(); refreshDebug() }
function debugEye(): void { presentation?.debugTestEye(); refreshDebug() }
function debugBreathing(): void { presentation?.debugTestBreathing(); refreshDebug() }
function formatTimeline(timestamp: number): string { return new Date(timestamp).toLocaleTimeString('zh-CN', { hour12: false }) }
async function loadVoiceStatus(): Promise<void> {
  try {
    const saved = JSON.parse(localStorage.getItem('ai-companion-audio-settings') || '{}') as { autoPlay?: unknown }
    if (typeof saved.autoPlay === 'boolean') voiceAutoPlay.value = saved.autoPlay
  } catch {}
  try {
    const [localResponse, providerResponse] = await Promise.all([fetch(apiUrl('/api/audio/gpt-sovits/status')), fetch(apiUrl('/api/audio/providers'))])
    const localBody = await localResponse.json() as { data?: { configured?: boolean; state?: string } }
    const providerBody = await providerResponse.json() as { data?: Array<{ enabled?: boolean }> }
    voiceProviderReady.value = localBody.data?.configured === true && localBody.data.state !== 'error' || Array.isArray(providerBody.data) && providerBody.data.some((provider) => provider.enabled !== false)
  } catch { voiceProviderReady.value = false }
}

onMounted(async () => {
  document.documentElement.classList.add('pet-window-html'); document.body.classList.add('pet-window-body'); window.addEventListener('keydown', handleKeydown)
  const api = window.electronAPI
  if (!api || !stageRef.value) { fallbackVisible.value = true; fallbackMessage.value = '请通过桌面应用启动桌宠'; return }
  try {
    const snapshot = await api.getPetSnapshot() as PetSnapshot
    applyConfig(snapshot.config); if (snapshot.layout) applyLayout(snapshot.layout)
    await ensureRuntime()
    const renderer = new PixiLive2DRendererAdapter(); await renderer.mount(stageRef.value)
    manager = new Live2DManager(renderer, (modelId, status, error) => api.updatePetModelStatus(modelId, status, error))
    presentation = new PresentationEngine(manager, refreshDebug)
    if (snapshot.characterEvent) handlePetEvent(snapshot.characterEvent)
    else await loadResolvedModel()
    removeEventListener = api.onPetEvent(handlePetEvent)
    removeConfigListener = api.onPetConfigChanged((nextConfig) => { const previousModel = config.modelId; applyConfig(nextConfig as PetConfig); if (previousModel !== config.modelId && !getCharacterAppearance(character, null).modelId) void loadResolvedModel() })
    removeLayoutListener = api.onPetLayoutChanged((nextLayout) => applyLayout(nextLayout as PetWindowLayout))
    removeCursorListener = api.onPetCursorPosition(handleCursorPosition)
    window.addEventListener('resize', () => manager?.resize())
    refreshDebug()
    void loadVoiceStatus()
  } catch (error) {
    logPetError('桌宠初始化失败', error)
    fallbackVisible.value = true
    fallbackMessage.value = error instanceof Error ? error.message : '桌宠初始化失败'
  }
})

onBeforeUnmount(() => {
  document.documentElement.classList.remove('pet-window-html'); document.body.classList.remove('pet-window-body'); window.removeEventListener('keydown', handleKeydown)
  clearBubbleTimer(); if (feedbackTimer !== null) window.clearTimeout(feedbackTimer)
  removeEventListener?.(); removeConfigListener?.(); removeLayoutListener?.(); removeCursorListener?.()
  presentation?.destroy(); manager?.destroy()
})
</script>

<style lang="scss">
html.pet-window-html, html.pet-window-html body, html.pet-window-html #app { background: transparent !important; }
html.pet-window-html body::before { display: none !important; }
</style>

<style scoped lang="scss">
.pet-shell { position: relative; width: 100vw; height: 100vh; overflow: hidden; user-select: none; touch-action: none; }
.pet-model-zone { position: absolute; bottom: 0; }
.pet-stage { position: absolute; inset: 0; transition: opacity .2s ease; }
.pet-stage.is-hidden { opacity: 0; pointer-events: none; }
:deep(.live2d-canvas) { display: block; width: 100%; height: 100%; }
.pet-bubble { position: absolute; z-index: 3; top: 18px; left: 18px; right: 18px; max-height: 190px; overflow: auto; padding: 13px 16px; border: 1px solid rgba(255,255,255,.76); border-radius: 18px 18px 18px 5px; background: rgba(255,255,255,.91); box-shadow: 0 14px 34px rgba(45,51,101,.18); backdrop-filter: blur(16px); color: #333a62; cursor: default; }
.bubble-label { display: block; margin-bottom: 4px; color: #747de3; font-size: 12px; font-weight: 700; }
.pet-bubble p { margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }.bubble-streaming { display: block; margin-top: 5px; color: #8790bb; font-size: 11px; }
.pet-fallback { position: absolute; right: 50%; bottom: 26px; display: grid; width: 220px; translate: 50% 0; place-items: center; gap: 10px; color: #fff; text-shadow: 0 2px 8px rgba(32,35,75,.55); }.pet-fallback img, .pet-fallback > span { width: 170px; height: 170px; border: 3px solid rgba(255,255,255,.75); border-radius: 50%; object-fit: cover; background: linear-gradient(145deg,#787ee9,#b680de); box-shadow: 0 14px 34px rgba(62,62,133,.28); font-size: 60px; line-height: 164px; }.pet-fallback small { max-width: 250px; font-size: 12px; text-align: center; }
.pet-menu { position: absolute; top: 50%; z-index: 8; display: grid; align-content: center; gap: 10px; padding: 16px; translate: 0 -50%; border: 1px solid rgba(255,255,255,.82); border-radius: 22px; background: linear-gradient(180deg,rgba(255,255,255,.97),rgba(241,244,255,.95)); box-shadow: 0 20px 48px rgba(35,42,95,.24); color: #394063; backdrop-filter: blur(18px); }.pet-menu-header { display: grid; gap: 2px; padding: 2px 5px 8px; }.pet-menu-header span { color: #8991bd; font-size: 11px; font-weight: 700; letter-spacing: .08em; }.pet-menu-header strong { font-size: 18px; }
.pet-menu-item,.pet-more-toggle { display: grid; width: 100%; min-height: 55px; padding: 10px 13px; border: 1px solid rgba(113,123,207,.14); border-radius: 14px; background: rgba(255,255,255,.72); color: #414b78; text-align: left; cursor: pointer; font: inherit; transition: background .16s ease,transform .16s ease,border-color .16s ease; }.pet-menu-item:hover,.pet-more-toggle:hover { border-color: rgba(104,115,214,.42); background: #fff; transform: translateY(-1px); }.pet-menu-item span { font-size: 17px; font-weight: 700; }.pet-menu-item small { margin-top: 2px; color: #9199bd; font-size: 11px; }
.pet-menu-scale { display: grid; gap: 8px; }.pet-scale-controls { display: grid; gap: 9px; padding: 3px 5px 0; }.pet-scale-controls input { width: 100%; accent-color: #6f78d6; }.pet-scale-buttons { display: grid; grid-template-columns: repeat(3,1fr); gap: 6px; }.pet-scale-buttons button,.pet-more-controls button { padding: 7px 5px; border: 1px solid rgba(113,123,207,.18); border-radius: 9px; background: rgba(255,255,255,.78); color: #5660aa; cursor: pointer; font: inherit; font-size: 11px; }.pet-more-settings { display: grid; gap: 8px; }.pet-more-toggle { min-height: 38px; padding: 8px 12px; font-size: 12px; font-weight: 700; }.pet-more-controls { display: grid; gap: 7px; padding: 0 5px; }.pet-more-controls label { display: flex; align-items: center; gap: 7px; color: #64709e; font-size: 12px; }.pet-menu-feedback { margin: 0; padding: 9px 10px; border-radius: 10px; background: rgba(112,122,215,.1); color: #626cb0; font-size: 11px; line-height: 1.45; }.pet-voice-controls { display: grid; gap: 7px; padding: 8px 5px; color: #64709e; font-size: 11px; }.pet-voice-controls button { padding: 7px; border: 1px solid rgba(113,123,207,.18); border-radius: 8px; background: rgba(255,255,255,.78); color: #5660aa; cursor: pointer; font: inherit; }.pet-voice-controls button:disabled { cursor: not-allowed; opacity: .45; }
.pet-debug { position: fixed; z-index: 20; top: 10px; right: 10px; display: grid; gap: 7px; width: min(340px,calc(100vw - 20px)); max-height: calc(100vh - 20px); overflow: auto; padding: 11px; border: 1px solid rgba(255,255,255,.64); border-radius: 12px; background: rgba(18,23,45,.88); box-shadow: 0 12px 30px rgba(0,0,0,.28); color: #e9ecff; font-size: 11px; backdrop-filter: blur(12px); }.pet-debug strong { color: #b9c4ff; font-size: 12px; }.pet-debug dl { display: grid; grid-template-columns: auto 1fr; gap: 3px 8px; margin: 0; }.pet-debug dt { color: #97a0c9; }.pet-debug dd { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.pet-debug-buttons { display: grid; grid-template-columns: repeat(2,1fr); gap: 5px; }.pet-debug button { padding: 5px; border: 1px solid rgba(186,199,255,.28); border-radius: 7px; background: rgba(110,125,204,.24); color: #f3f5ff; cursor: pointer; font-size: 10px; }.pet-debug details { display: grid; gap: 3px; }.pet-debug summary { cursor: pointer; color: #c2cbff; }.pet-debug code { display: block; overflow: hidden; color: #d5daf8; font-family: Consolas,monospace; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.pet-debug { width: min(390px, calc(100vw - 20px)); max-height: calc(100vh - 20px); overflow-y: auto; overscroll-behavior: contain; gap: 10px; padding: 13px; }
.pet-menu.has-debug { width: min(252px, calc(100vw - 20px)) !important; max-height: calc(100vh - 20px); overflow-y: auto; align-content: start; }
.pet-menu.has-debug .pet-debug { position: static; width: auto; max-height: none; overflow: visible; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; backdrop-filter: none; }
.pet-menu.has-debug .debug-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
.pet-menu.has-debug .debug-form { grid-template-columns: minmax(0,1fr); }
.pet-menu.has-debug .debug-inline input[type="range"],.pet-menu.has-debug .debug-form input[type="range"] { width: 78px; }
.pet-menu.has-debug .debug-inline select,.pet-menu.has-debug .debug-form select { max-width: 104px; }
.pet-debug-menu-item { border-color: rgba(111,123,214,.4); background: rgba(112,122,215,.12); }
.pet-debug-header,.debug-section-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.pet-debug-header small { display: block; margin-top: 3px; color: #8994bd; font-size: 10px; }
.pet-debug-header button,.debug-section-title button,.debug-list button { padding: 4px 7px; border: 1px solid rgba(186,199,255,.28); border-radius: 6px; background: rgba(110,125,204,.24); color: #f3f5ff; cursor: pointer; font-size: 10px; }
.debug-section { display: grid; gap: 7px; padding-top: 8px; border-top: 1px solid rgba(186,199,255,.16); }
.debug-section h3 { margin: 0; color: #c8d0ff; font-size: 11px; }
.debug-section dl { grid-template-columns: max-content minmax(0,1fr); }
.debug-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 5px; }
.debug-grid button,.debug-inline button,.debug-form button { min-width: 0; padding: 6px 5px; border: 1px solid rgba(186,199,255,.28); border-radius: 7px; background: rgba(110,125,204,.24); color: #f3f5ff; cursor: pointer; font-size: 10px; }
.pet-debug button:disabled { cursor: not-allowed; opacity: .42; }
.debug-inline { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; }
.debug-inline label,.debug-form label { display: flex; align-items: center; gap: 5px; color: #aab4df; font-size: 10px; }
.debug-inline select,.debug-form select,.debug-form input[type="number"],.debug-form input[placeholder] { min-width: 0; max-width: 120px; padding: 5px; border: 1px solid rgba(186,199,255,.25); border-radius: 6px; background: rgba(8,12,30,.5); color: #f3f5ff; font-size: 10px; }
.debug-inline input[type="range"],.debug-form input[type="range"] { width: 90px; accent-color: #9da9ff; }
.debug-form { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 6px; align-items: center; }
.debug-form output { min-width: 28px; color: #d5dcff; font-family: Consolas,monospace; }
.debug-muted { margin: 0; color: #8994bd; font-size: 10px; line-height: 1.4; }
.debug-list { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
.debug-list li { display: flex; align-items: center; justify-content: space-between; gap: 5px; color: #d5daf8; font-family: Consolas,monospace; font-size: 10px; }
.debug-list button { flex: none; }
.debug-timeline { display: grid; gap: 4px; max-height: 180px; overflow: auto; }
.debug-timeline code { overflow: visible; white-space: normal; line-height: 1.35; }
.pet-debug-entry { position: fixed; z-index: 20; top: 10px; right: 10px; padding: 7px 10px; border: 1px solid rgba(186,199,255,.35); border-radius: 7px; background: rgba(18,23,45,.88); color: #e9ecff; cursor: pointer; font-size: 11px; backdrop-filter: blur(12px); }
@media (max-width: 520px) { .pet-debug { left: 10px; right: 10px; width: auto; } .debug-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } .debug-form { grid-template-columns: minmax(0,1fr); } }
</style>



