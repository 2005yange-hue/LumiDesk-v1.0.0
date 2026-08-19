export type TtsStatus = 'idle' | 'requesting' | 'playing' | 'stopping' | 'error'
export type SttStatus = 'idle' | 'recording' | 'transcribing' | 'error'
export type TtsEngine = 'gpt-sovits' | 'provider'

export interface AudioProviderInfo {
  id: number
  user_id: string
  name: string
  provider_type: string
  base_url: string
  api_key: string
  tts_model: string
  stt_model: string
  default_voice: string
  default_speed: number
  enabled: boolean
  is_default: boolean
  timeout: number
  custom_headers: string | null
  created_at: string
  updated_at: string
}

export interface AudioProviderData {
  name: string
  provider_type?: string
  base_url: string
  api_key: string
  tts_model: string
  stt_model: string
  default_voice?: string
  default_speed?: number
  enabled?: boolean
  is_default?: boolean
  timeout?: number
  custom_headers?: string | null
}

export interface SttResult { text: string; durationMs: number }
export interface AudioTestResult { success: boolean; connected?: boolean; tts: boolean; stt: boolean; message?: string }

export interface GptSovitsStatus {
  installed: boolean
  configured: boolean
  state: 'unavailable' | 'stopped' | 'starting' | 'idle' | 'inferencing' | 'error'
  version: 'v2ProPlus'
  model: string
  device: string
  pid: number | null
  error: string | null
}

export interface GptSovitsReference { id: string; label: string; language: string }

export interface AudioSettings {
  ttsEngine: TtsEngine
  autoPlay: boolean
  volume: number
  voice: string
  speed: number
  providerId: number | null
  gptSovits: {
    referenceId: string
    promptText: string
    promptLang: string
    textLang: string
  }
}
