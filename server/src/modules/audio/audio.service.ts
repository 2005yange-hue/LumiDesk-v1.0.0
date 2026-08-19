import { BadRequestException, Injectable, RequestTimeoutException, ServiceUnavailableException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AudioProvider } from './entities/audio-provider.entity'
import type { CreateAudioProviderDto } from './dto/create-audio-provider.dto'
import type { UpdateAudioProviderDto } from './dto/update-audio-provider.dto'
import type { TtsDto } from './dto/tts.dto'
import type { SttDto } from './dto/stt.dto'
import { GptSovitsService } from './gpt-sovits.service'

const MAX_AUDIO_BYTES = 10 * 1024 * 1024
const ALLOWED_AUDIO_TYPES = new Set(['audio/webm', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/mpeg'])

@Injectable()
export class AudioService {
  constructor(@InjectRepository(AudioProvider) private readonly repo: Repository<AudioProvider>, private readonly gptSovits: GptSovitsService) {}

  async list(userId = 'default'): Promise<AudioProvider[]> {
    const rows = await this.repo.find({ where: { user_id: userId }, order: { is_default: 'DESC', enabled: 'DESC', created_at: 'DESC' } })
    return rows.map((row) => this.mask(row))
  }

  async active(userId = 'default'): Promise<AudioProvider | null> {
    const row = await this.repo.findOne({ where: { user_id: userId, enabled: true }, order: { is_default: 'DESC', created_at: 'ASC' } })
    return row ? this.mask(row) : null
  }

  async create(dto: CreateAudioProviderDto): Promise<AudioProvider> {
    const userId = dto.user_id || 'default'
    if (dto.is_default) await this.repo.update({ user_id: userId, is_default: true }, { is_default: false })
    const row = this.repo.create({ ...dto, user_id: userId, provider_type: dto.provider_type || 'openai-compatible', enabled: dto.enabled ?? true, default_voice: dto.default_voice || 'alloy', default_speed: dto.default_speed ?? 1, timeout: dto.timeout ?? 30000 })
    return this.mask(await this.repo.save(row))
  }

  async update(id: number, dto: UpdateAudioProviderDto): Promise<AudioProvider | null> {
    if (dto.api_key?.includes('****')) delete dto.api_key
    if (dto.is_default) {
      const existing = await this.repo.findOneBy({ id })
      if (existing) await this.repo.update({ user_id: existing.user_id, is_default: true }, { is_default: false })
    }
    await this.repo.update(id, dto)
    const row = await this.repo.findOneBy({ id })
    return row ? this.mask(row) : null
  }

  async remove(id: number): Promise<void> { await this.repo.delete(id) }

  async test(id: number): Promise<{ success: boolean; connected: boolean; tts: boolean; stt: boolean; message?: string }> {
    const provider = await this.getProvider(id)
    const result = { success: false, connected: false, tts: false, stt: false } as { success: boolean; connected: boolean; tts: boolean; stt: boolean; message?: string }
    try {
      const response = await this.request(provider, '/models', { method: 'GET' })
      result.connected = response.ok
      if (!response.ok) {
        result.message = `Provider 接口不可连接（HTTP ${response.status}）`
        return result
      }

      // Connectivity and capability are separate checks. STT needs a real
      // recording, so it remains false until the user runs an actual upload.
      const ttsResponse = await this.request(provider, '/audio/speech', {
        method: 'POST',
        body: JSON.stringify({ model: provider.tts_model, input: 'LumiDesk 语音测试', voice: provider.default_voice, speed: provider.default_speed, response_format: 'mp3' })
      })
      const ttsBytes = ttsResponse.ok ? (await ttsResponse.arrayBuffer()).byteLength : 0
      result.tts = ttsResponse.ok && ttsBytes > 0
      result.success = true
      result.message = result.tts
        ? '接口已连接，TTS 可用；STT 需要上传录音后验证'
        : `接口已连接，但 TTS 不可用（HTTP ${ttsResponse.status}）`
    } catch (error) { result.message = error instanceof Error ? error.message : String(error) }
    return result
  }

  async synthesize(dto: TtsDto): Promise<{ buffer: Buffer; contentType: string }> {
    if (dto.engine === 'gpt-sovits') {
      return this.gptSovits.synthesize({ text: dto.text, textLang: dto.textLang, referenceId: dto.referenceId, promptText: dto.promptText, promptLang: dto.promptLang, speed: dto.speed })
    }
    const provider = await this.getProvider(dto.providerId)
    if (!dto.text.trim()) throw new BadRequestException('朗读文本不能为空')
    const format = dto.format || 'mp3'
    const response = await this.request(provider, '/audio/speech', { method: 'POST', body: JSON.stringify({ model: provider.tts_model, input: dto.text.trim(), voice: dto.voice || provider.default_voice, speed: dto.speed ?? provider.default_speed, response_format: format }) })
    if (!response.ok) throw new ServiceUnavailableException({ code: 'AUDIO_TTS_UPSTREAM_ERROR', message: `TTS 服务返回 HTTP ${response.status}` })
    const arrayBuffer = await response.arrayBuffer()
    if (!arrayBuffer.byteLength) throw new BadRequestException('TTS 返回空音频')
    return { buffer: Buffer.from(arrayBuffer), contentType: response.headers.get('content-type')?.split(';')[0] || this.contentType(format) }
  }

  async transcribe(file: { buffer: Buffer; mimetype: string; size: number } | undefined, dto: SttDto): Promise<{ text: string; durationMs: number }> {
    if (!file?.buffer?.length) throw new BadRequestException('录音文件为空')
    if (file.size > MAX_AUDIO_BYTES) throw new BadRequestException('录音文件不能超过 10MB')
    if (dto.durationMs !== undefined && dto.durationMs > 30_000) throw new BadRequestException('单次录音不能超过 30 秒')
    const mimeType = file.mimetype.split(';', 1)[0].trim().toLowerCase()
    if (!ALLOWED_AUDIO_TYPES.has(mimeType)) throw new BadRequestException('不支持的录音格式')
    const provider = await this.getProvider(dto.providerId)
    const form = new FormData()
    const extension = mimeType === 'audio/ogg' ? 'ogg' : mimeType === 'audio/wav' || mimeType === 'audio/x-wav' ? 'wav' : mimeType === 'audio/mp4' ? 'mp4' : mimeType === 'audio/mpeg' ? 'mp3' : 'webm'
    form.append('file', new Blob([file.buffer], { type: mimeType }), `recording.${extension}`)
    form.append('model', dto.model || provider.stt_model)
    form.append('response_format', 'json')
    if (dto.language) form.append('language', dto.language)
    const response = await this.request(provider, '/audio/transcriptions', { method: 'POST', body: form })
    if (!response.ok) throw new ServiceUnavailableException({ code: 'AUDIO_STT_UPSTREAM_ERROR', message: `STT 服务返回 HTTP ${response.status}` })
    const body = await response.json() as { text?: string }
    return { text: typeof body.text === 'string' ? body.text.trim() : '', durationMs: dto.durationMs ?? 0 }
  }

  private async getProvider(id?: number): Promise<AudioProvider> {
    const row = id ? await this.repo.findOneBy({ id, enabled: true }) : await this.repo.findOne({ where: { enabled: true }, order: { is_default: 'DESC', created_at: 'ASC' } })
    if (!row) throw new ServiceUnavailableException({ code: 'AUDIO_PROVIDER_UNAVAILABLE', message: '未配置可用的语音 Provider' })
    return row
  }

  private async request(provider: AudioProvider, path: string, init: RequestInit): Promise<Response> {
    const headers = this.parseHeaders(provider.custom_headers)
    headers.Authorization = `Bearer ${provider.api_key}`
    if (!(init.body instanceof FormData)) headers['Content-Type'] = 'application/json'
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), provider.timeout || 30000)
    try { return await fetch(`${provider.base_url.replace(/\/+$/, '')}${path}`, { ...init, headers, signal: controller.signal }) }
    catch (error) { if (error instanceof Error && error.name === 'AbortError') throw new RequestTimeoutException('语音 Provider 请求超时'); throw error }
    finally { clearTimeout(timeout) }
  }

  private parseHeaders(value: string | null): Record<string, string> { try { const parsed = value ? JSON.parse(value) : {}; return parsed && typeof parsed === 'object' ? Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === 'string')) as Record<string, string> : {} } catch { return {} } }
  private contentType(format: string): string { return format === 'wav' ? 'audio/wav' : format === 'opus' ? 'audio/ogg' : `audio/${format}` }
  private mask(row: AudioProvider): AudioProvider { const copy = { ...row }; if (copy.api_key) copy.api_key = copy.api_key.length > 10 ? `${copy.api_key.slice(0, 3)}****${copy.api_key.slice(-4)}` : '****'; return copy }
}
