import axios from 'axios'
import type { AudioProviderData, AudioProviderInfo, AudioTestResult, GptSovitsReference, GptSovitsStatus, SttResult, TtsEngine } from '@/types/audio.types'

const BASE = '/api/audio'

export async function getAudioProviders(): Promise<AudioProviderInfo[]> { const { data } = await axios.get(`${BASE}/providers`); return data.data }
export async function getActiveAudioProvider(): Promise<AudioProviderInfo | null> { const { data } = await axios.get(`${BASE}/providers/active`); return data.data }
export async function createAudioProvider(dto: AudioProviderData): Promise<AudioProviderInfo> { const { data } = await axios.post(`${BASE}/providers`, dto); return data.data }
export async function updateAudioProvider(id: number, dto: Partial<AudioProviderData>): Promise<AudioProviderInfo | null> { const { data } = await axios.put(`${BASE}/providers/${id}`, dto); return data.data }
export async function deleteAudioProvider(id: number): Promise<void> { await axios.delete(`${BASE}/providers/${id}`) }
export async function testAudioProvider(id: number): Promise<AudioTestResult> { const { data } = await axios.post(`${BASE}/providers/${id}/test`); return data.data }
export async function getGptSovitsStatus(): Promise<GptSovitsStatus> { const { data } = await axios.get(`${BASE}/gpt-sovits/status`); return data.data }
export async function getGptSovitsReferences(): Promise<GptSovitsReference[]> { const { data } = await axios.get(`${BASE}/gpt-sovits/references`); return data.data }
export async function testGptSovits(options: Record<string, unknown> = {}): Promise<{ success: boolean; durationMs: number; bytes: number; message?: string }> { const { data } = await axios.post(`${BASE}/gpt-sovits/test`, options); return data.data }

export async function requestTts(text: string, options: { engine?: TtsEngine; providerId?: number; voice?: string; speed?: number; format?: string; referenceId?: string; promptText?: string; promptLang?: string; textLang?: string } = {}, signal?: AbortSignal): Promise<Blob> {
  const response = await axios.post(`${BASE}/tts`, { text, ...options }, { responseType: 'blob', signal })
  return response.data
}

export async function requestStt(blob: Blob, options: { providerId?: number; language?: string; model?: string; durationMs?: number } = {}, signal?: AbortSignal): Promise<SttResult> {
  const form = new FormData()
  const mime = blob.type.split(';', 1)[0].toLowerCase()
  const extension = mime === 'audio/ogg' ? 'ogg' : mime === 'audio/mp4' ? 'mp4' : mime === 'audio/wav' || mime === 'audio/x-wav' ? 'wav' : 'webm'
  form.append('file', blob, `recording.${extension}`)
  if (options.providerId) form.append('providerId', String(options.providerId))
  if (options.language) form.append('language', options.language)
  if (options.model) form.append('model', options.model)
  if (options.durationMs !== undefined) form.append('durationMs', String(Math.min(30_000, Math.max(0, Math.round(options.durationMs)))))
  const { data } = await axios.post(`${BASE}/stt`, form, { signal, headers: { 'Content-Type': 'multipart/form-data' } })
  return data.data
}
