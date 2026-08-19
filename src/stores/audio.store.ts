import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AudioProviderData, AudioProviderInfo, AudioSettings, AudioTestResult, GptSovitsReference, GptSovitsStatus, SttStatus, TtsStatus } from '@/types/audio.types'
import { createAudioProvider, deleteAudioProvider, getActiveAudioProvider, getAudioProviders, getGptSovitsReferences, getGptSovitsStatus, requestStt, requestTts, testAudioProvider, testGptSovits, updateAudioProvider } from '@/services/audio.api'
import { petEventBus } from '@/live2d/pet-event-bus'

const SETTINGS_KEY = 'ai-companion-audio-settings'

const DEFAULT_SETTINGS: AudioSettings = { ttsEngine: 'gpt-sovits', autoPlay: true, volume: 1, voice: 'alloy', speed: 1, providerId: null, gptSovits: { referenceId: '分かった.wav', promptText: '分かった。', promptLang: 'ja', textLang: 'zh' } }

export const useAudioStore = defineStore('audio', () => {
  const providers = ref<AudioProviderInfo[]>([])
  const activeProvider = ref<AudioProviderInfo | null>(null)
  const gptSovitsStatus = ref<GptSovitsStatus | null>(null)
  const gptSovitsReferences = ref<GptSovitsReference[]>([])
  const ttsStatus = ref<TtsStatus>('idle')
  const sttStatus = ref<SttStatus>('idle')
  const currentMessageId = ref<string | null>(null)
  const lastCompletedMessageId = ref<string | null>(null)
  const ttsError = ref('')
  const sttError = ref('')
  const recordingMs = ref(0)
  const settings = ref<AudioSettings>(loadSettings())
  const isPlaying = computed(() => ttsStatus.value === 'playing' || ttsStatus.value === 'requesting')
  let audio: HTMLAudioElement | null = null
  let objectUrl = ''
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let sourceNode: MediaElementAudioSourceNode | null = null
  let bufferSource: AudioBufferSourceNode | null = null
  let gainNode: GainNode | null = null
  let amplitudeFrame = 0
  let ttsAbort: AbortController | null = null
  let sttAbort: AbortController | null = null
  let recorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let chunks: BlobPart[] = []
  let recordingStartedAt = 0
  let recordingTimer: number | null = null
  let currentText = ''
  let ttsRequestText = ''
  let playbackGeneration = 0

  function loadSettings(): AudioSettings {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as Partial<AudioSettings>
      return { ...DEFAULT_SETTINGS, ...saved, gptSovits: { ...DEFAULT_SETTINGS.gptSovits, ...(saved.gptSovits || {}) } }
    } catch { return { ...DEFAULT_SETTINGS, gptSovits: { ...DEFAULT_SETTINGS.gptSovits } } }
  }
  function persistSettings(): void { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings.value)) }
  function updateSettings(patch: Partial<AudioSettings>): void { settings.value = { ...settings.value, ...patch }; persistSettings() }
  function primePlayback(): void {
    try {
      if (!audioContext) audioContext = new AudioContext()
      if (audioContext.state === 'suspended') void audioContext.resume()
    } catch {}
  }

  async function fetchProviders(): Promise<void> { try { providers.value = await getAudioProviders(); const configured = providers.value.find((p) => p.id === settings.value.providerId && p.enabled); activeProvider.value = configured || providers.value.find((p) => p.is_default && p.enabled) || providers.value.find((p) => p.enabled) || null; if (activeProvider.value && settings.value.providerId !== activeProvider.value.id) updateSettings({ providerId: activeProvider.value.id }); if (!activeProvider.value) updateSettings({ providerId: null }) } catch { providers.value = []; activeProvider.value = null; updateSettings({ providerId: null }) } }
  async function fetchActive(): Promise<void> { try { activeProvider.value = await getActiveAudioProvider() } catch { activeProvider.value = null } }
  async function fetchGptSovits(): Promise<void> {
    try { gptSovitsStatus.value = await getGptSovitsStatus(); gptSovitsReferences.value = await getGptSovitsReferences(); if (!gptSovitsReferences.value.some((item) => item.id === settings.value.gptSovits.referenceId) && gptSovitsReferences.value[0]) updateSettings({ gptSovits: { ...settings.value.gptSovits, referenceId: gptSovitsReferences.value[0].id } }) }
    catch { gptSovitsStatus.value = null; gptSovitsReferences.value = [] }
  }
  async function createProvider(data: AudioProviderData): Promise<AudioProviderInfo | null> { try { const row = await createAudioProvider(data); await fetchProviders(); return row } catch { return null } }
  async function updateProvider(id: number, data: Partial<AudioProviderData>): Promise<AudioProviderInfo | null> { try { const row = await updateAudioProvider(id, data); await fetchProviders(); return row } catch { return null } }
  async function removeProvider(id: number): Promise<boolean> { try { await deleteAudioProvider(id); await fetchProviders(); return true } catch { return false } }
  async function testProvider(id: number): Promise<AudioTestResult | null> { try { return await testAudioProvider(id) } catch (error) { return { success: false, tts: false, stt: false, message: String(error) } } }
  async function testLocalTts(): Promise<{ success: boolean; durationMs: number; bytes: number; message?: string }> { return testGptSovits(settings.value.gptSovits) }

  function stopAmplitude(): void {
    if (amplitudeFrame) cancelAnimationFrame(amplitudeFrame)
    amplitudeFrame = 0
    sourceNode?.disconnect()
    analyser?.disconnect()
    sourceNode = null
    analyser = null
  }
  function startAmplitude(): void {
    if (!audioContext || !bufferSource || !analyser) return
    try {
      const activeAnalyser = analyser
      const values = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => { if (!bufferSource || !activeAnalyser) return; activeAnalyser.getByteTimeDomainData(values); let sum = 0; for (const value of values) { const normalized = (value - 128) / 128; sum += normalized * normalized }; const rms = Math.min(1, Math.sqrt(sum / values.length) * 3); petEventBus.publish({ type: 'voice_amplitude', payload: { value: rms } }); amplitudeFrame = requestAnimationFrame(tick) }
      amplitudeFrame = requestAnimationFrame(tick)
    } catch { stopAmplitude() }
  }
  function revokeAudio(): void {
    stopAmplitude()
    if (bufferSource) bufferSource.onended = null
    try { bufferSource?.stop() } catch {}
    bufferSource?.disconnect()
    gainNode?.disconnect()
    bufferSource = null
    gainNode = null
    if (audio) { audio.onended = null; audio.onerror = null; audio.pause(); audio.src = '' }
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    audio = null
    objectUrl = ''
  }
  function clearVoiceEvent(type: 'voice_stop' | 'voice_error' | 'voice_fallback'): void { petEventBus.publish({ type, payload: {} }) }
  async function stopTts(): Promise<void> {
    if (ttsStatus.value === 'idle' && !ttsAbort && !audio && !bufferSource) return
    playbackGeneration += 1
    ttsStatus.value = 'stopping'
    ttsAbort?.abort()
    ttsAbort = null
    revokeAudio()
    clearVoiceEvent('voice_stop')
    ttsStatus.value = 'idle'
    currentMessageId.value = null
    currentText = ''
  }

  async function playTts(text: string, messageId: string, force = false): Promise<boolean> {
    const normalizedText = text.trim()
    if (!normalizedText || (!force && !settings.value.autoPlay)) return false
    if (!force && ttsRequestText === normalizedText) return true
    if (!force && currentText === normalizedText && (ttsStatus.value === 'requesting' || ttsStatus.value === 'playing')) return true
    if (settings.value.ttsEngine === 'provider' && !activeProvider.value?.enabled) { ttsError.value = '未配置可用的语音 Provider'; ttsStatus.value = 'error'; clearVoiceEvent('voice_fallback'); return false }
    ttsRequestText = normalizedText
    await stopTts()
    const generation = ++playbackGeneration
    ttsStatus.value = 'requesting'; ttsError.value = ''; currentMessageId.value = messageId; currentText = normalizedText; ttsAbort = new AbortController()
    try {
      const blob = await requestTts(text, settings.value.ttsEngine === 'gpt-sovits' ? { engine: 'gpt-sovits', speed: settings.value.speed, ...settings.value.gptSovits } : { engine: 'provider', providerId: settings.value.providerId || undefined, voice: settings.value.voice, speed: settings.value.speed }, ttsAbort.signal)
      if (generation !== playbackGeneration) return false
      if (!audioContext) audioContext = new AudioContext()
      if (audioContext.state === 'suspended') await audioContext.resume()
      const audioData = await blob.arrayBuffer()
      const decoded = await audioContext.decodeAudioData(audioData.slice(0))
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      gainNode = audioContext.createGain()
      gainNode.gain.value = Math.min(1, Math.max(0, settings.value.volume))
      bufferSource = audioContext.createBufferSource()
      bufferSource.buffer = decoded
      bufferSource.connect(gainNode)
      gainNode.connect(analyser)
      analyser.connect(audioContext.destination)
      bufferSource.onended = () => {
        if (generation !== playbackGeneration) return
        revokeAudio(); ttsStatus.value = 'idle'; currentMessageId.value = null; lastCompletedMessageId.value = messageId; currentText = ''; ttsAbort = null
        petEventBus.publish({ type: 'voice_complete', payload: { messageId } })
      }
      petEventBus.publish({ type: 'voice_start', payload: { messageId } })
      ttsStatus.value = 'playing'
      startAmplitude()
      bufferSource.start(0)
      ttsRequestText = ''
      return true
    } catch (error) {
      revokeAudio(); if ((error as Error)?.name === 'CanceledError' || (error as Error)?.name === 'AbortError') { ttsRequestText = ''; return false }
      if (generation !== playbackGeneration) return false
      ttsStatus.value = 'error'
      ttsError.value = error instanceof Error && /decode|buffer|audio/i.test(error.message) ? `音频解码失败：${error.message}` : '自动播放被阻止，请点击朗读按钮重试'
      clearVoiceEvent('voice_error')
      ttsRequestText = ''
      return false
    }
  }

  async function startRecording(): Promise<void> {
    if (sttStatus.value === 'recording' || sttStatus.value === 'transcribing') return
    sttStatus.value = 'idle'
    sttError.value = ''
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true }); chunks = []; const preferredType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4'].find((type) => typeof MediaRecorder.isTypeSupported !== 'function' || MediaRecorder.isTypeSupported(type)); recorder = preferredType ? new MediaRecorder(stream, { mimeType: preferredType }) : new MediaRecorder(stream); recordingStartedAt = Date.now(); recordingMs.value = 0
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      recorder.start(); sttStatus.value = 'recording'; recordingTimer = window.setInterval(() => { recordingMs.value = Date.now() - recordingStartedAt; if (recordingMs.value >= 30_000) void stopRecording() }, 100)
    } catch { stream?.getTracks().forEach((track) => track.stop()); stream = null; recorder = null; sttStatus.value = 'error'; sttError.value = '无法访问麦克风，请检查系统权限' }
  }
  async function stopRecording(): Promise<string> {
    if (!recorder || sttStatus.value !== 'recording') return ''
    const activeRecorder = recorder; sttStatus.value = 'transcribing'; if (recordingTimer !== null) window.clearInterval(recordingTimer); recordingTimer = null
    const result = await new Promise<Blob>((resolve) => { activeRecorder.onstop = () => resolve(new Blob(chunks, { type: activeRecorder.mimeType || 'audio/webm' })); activeRecorder.stop() })
    stream?.getTracks().forEach((track) => track.stop()); stream = null; recorder = null; chunks = []
    sttAbort?.abort(); sttAbort = new AbortController()
    try { const response = await requestStt(result, { providerId: activeProvider.value?.id || undefined, durationMs: recordingMs.value }, sttAbort.signal); sttAbort = null; sttStatus.value = 'idle'; recordingMs.value = 0; return response.text } catch (error) { sttAbort = null; sttStatus.value = 'error'; sttError.value = (error as Error)?.name === 'CanceledError' ? '识别已取消' : '语音识别失败，请重试'; recordingMs.value = 0; return '' }
  }
  function cancelRecording(): void { if (recordingTimer !== null) window.clearInterval(recordingTimer); recordingTimer = null; sttAbort?.abort(); sttAbort = null; try { if (recorder?.state !== 'inactive') recorder?.stop() } catch {} stream?.getTracks().forEach((track) => track.stop()); recorder = null; stream = null; chunks = []; recordingMs.value = 0; sttStatus.value = 'idle'; sttError.value = '' }

  return { providers, activeProvider, gptSovitsStatus, gptSovitsReferences, ttsStatus, sttStatus, currentMessageId, lastCompletedMessageId, ttsError, sttError, recordingMs, settings, isPlaying, updateSettings, primePlayback, fetchProviders, fetchActive, fetchGptSovits, createProvider, updateProvider, removeProvider, testProvider, testLocalTts, playTts, stopTts, startRecording, stopRecording, cancelRecording }
})
