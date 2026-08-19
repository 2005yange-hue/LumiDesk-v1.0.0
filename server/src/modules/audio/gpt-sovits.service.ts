import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path'

export type GptSovitsState = 'unavailable' | 'stopped' | 'starting' | 'idle' | 'inferencing' | 'error'

export interface GptSovitsStatus {
  installed: boolean
  configured: boolean
  state: GptSovitsState
  version: 'v2ProPlus'
  model: string
  device: string
  pid: number | null
  error: string | null
}

export interface GptSovitsSynthesisOptions {
  text: string
  textLang?: string
  referenceId?: string
  promptText?: string
  promptLang?: string
  speed?: number
}

interface WeightManifest {
  GPT?: Record<string, string>
  SoVITS?: Record<string, string>
}

const AUDIO_EXTENSIONS = new Set(['.wav', '.ogg', '.flac', '.mp3', '.m4a'])
const DEFAULT_REFERENCE_ID = '分かった.wav'
const DEFAULT_PROMPT_TEXT = '分かった。'
const DEFAULT_FALLBACK_REFERENCE_ID = 'うん！かわいい.wav'
const DEFAULT_FALLBACK_PROMPT_TEXT = 'うん！かわいい。'
const DEFAULT_PROMPT_LANG = 'ja'
const DEFAULT_TEXT_LANG = 'zh'

@Injectable()
export class GptSovitsService implements OnApplicationShutdown {
  private readonly logger = new Logger(GptSovitsService.name)
  private child: ChildProcessWithoutNullStreams | null = null
  private startPromise: Promise<void> | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private state: GptSovitsState = 'stopped'
  private lastError: string | null = null

  constructor(private readonly config: ConfigService) {}

  status(): GptSovitsStatus {
    const paths = this.resolvePaths()
    const installed = existsSync(paths.python) && existsSync(paths.api) && existsSync(paths.root)
    const configured = installed && existsSync(paths.gptWeights) && existsSync(paths.sovitsWeights) && existsSync(paths.bert) && existsSync(paths.hubert) && existsSync(paths.v2Pro)
    return {
      installed,
      configured,
      state: configured ? this.state : 'unavailable',
      version: 'v2ProPlus',
      model: 'Mujica_若葉睦_v2pp',
      device: this.device,
      pid: this.child && !this.child.killed ? this.child.pid ?? null : null,
      error: this.lastError
    }
  }

  listReferences(): Array<{ id: string; label: string; language: string }> {
    const dir = this.resolvePaths().references
    if (!existsSync(dir)) return []
    try {
      return readdirSync(dir, { withFileTypes: true })
        .filter((entry: { isFile: () => boolean; name: string }) => entry.isFile() && AUDIO_EXTENSIONS.has(extname(entry.name).toLowerCase()))
        .map((entry: { name: string }) => ({ id: entry.name, label: entry.name, language: 'ja' }))
        .sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, 'zh-CN'))
    } catch {
      return []
    }
  }

  async test(options: Partial<GptSovitsSynthesisOptions> = {}): Promise<{ success: boolean; durationMs: number; bytes: number; message?: string }> {
    const startedAt = Date.now()
    try {
      const result = await this.synthesize({
        text: '你好，这是 LumiDesk 的语音测试。',
        ...options
      })
      return { success: true, durationMs: Date.now() - startedAt, bytes: result.buffer.length }
    } catch (error) {
      return { success: false, durationMs: Date.now() - startedAt, bytes: 0, message: error instanceof Error ? error.message : String(error) }
    }
  }

  async synthesize(options: GptSovitsSynthesisOptions): Promise<{ buffer: Buffer; contentType: string }> {
    const previous = this.queue
    let release!: () => void
    this.queue = new Promise<void>((resolveQueue) => { release = resolveQueue })
    await previous
    this.state = 'inferencing'
    try {
      await this.ensureReady()
      const paths = this.resolvePaths()
      const referenceId = options.referenceId || DEFAULT_REFERENCE_ID
      const referencePath = this.resolveReference(referenceId)
      const payload = {
        text: options.text.trim(),
        text_lang: options.textLang || DEFAULT_TEXT_LANG,
        ref_audio_path: referencePath,
        prompt_lang: options.promptLang || DEFAULT_PROMPT_LANG,
        prompt_text: options.promptText || DEFAULT_PROMPT_TEXT,
        speed_factor: options.speed ?? 1,
        media_type: 'wav',
        streaming_mode: false
      }
      let response = await this.request('/tts', { method: 'POST', body: JSON.stringify(payload) }, this.inferTimeout)
      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        // The bundled default clip is shorter than GPT-SoVITS' required 3-10s range.
        // Keep the documented default, but make first-run playback usable when the
        // bundled fallback clip is available. Explicit user selections remain strict.
        if (referenceId === DEFAULT_REFERENCE_ID && response.status === 400 && detail.includes('3~10')) {
          const fallbackPath = this.resolveReference(DEFAULT_FALLBACK_REFERENCE_ID)
          response = await this.request('/tts', { method: 'POST', body: JSON.stringify({ ...payload, ref_audio_path: fallbackPath, prompt_text: DEFAULT_FALLBACK_PROMPT_TEXT }) }, this.inferTimeout)
        }
      }
      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        throw new Error(`GPT-SoVITS 推理失败 HTTP ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ''}`)
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      if (!buffer.length) throw new Error('GPT-SoVITS 返回空音频')
      this.state = 'idle'
      this.lastError = null
      return { buffer, contentType: response.headers.get('content-type')?.split(';')[0] || 'audio/wav' }
    } catch (error) {
      this.state = 'error'
      this.lastError = error instanceof Error ? error.message : String(error)
      throw error
    } finally {
      release()
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.stop()
  }

  private get root(): string {
    const configured = this.config.get<string>('GPT_SOVITS_ROOT')
    if (configured) return isAbsolute(configured) ? configured : resolve(process.cwd(), configured)
    const candidates = [
      resolve(process.cwd(), '../GPT-SoVITS-v2pro-20250604'),
      resolve(process.cwd(), 'GPT-SoVITS-v2pro-20250604')
    ]
    return candidates.find((candidate) => existsSync(candidate)) || candidates[0]
  }

  private get host(): string { return this.config.get<string>('GPT_SOVITS_HOST', '127.0.0.1') }
  private get port(): number { return this.config.get<number>('GPT_SOVITS_PORT', 9880) }
  private get baseUrl(): string { return `http://${this.host}:${this.port}` }
  private get device(): string { return this.config.get<string>('GPT_SOVITS_DEVICE', 'cuda:0') }
  private get startTimeout(): number { return this.config.get<number>('GPT_SOVITS_START_TIMEOUT', 120000) }
  private get inferTimeout(): number { return this.config.get<number>('GPT_SOVITS_INFER_TIMEOUT', 120000) }

  private resolvePaths(): { root: string; python: string; api: string; config: string; references: string; gptWeights: string; sovitsWeights: string; bert: string; hubert: string; v2Pro: string } {
    const root = this.root
    const dataDir = this.config.get<string>('LUMIDESK_DATA_DIR', resolve(process.cwd(), 'data'))
    let manifest: WeightManifest = {}
    try { manifest = JSON.parse(readFileSync(resolve(root, 'weight.json'), 'utf8')) as WeightManifest } catch { /* status() reports missing configuration */ }
    const gptWeights = resolve(root, manifest.GPT?.v2 || 'GPT_weights_v2ProPlus/Mujica_若葉睦_v2pp.ckpt')
    const sovitsWeights = resolve(root, manifest.SoVITS?.v2 || 'SoVITS_weights_v2ProPlus/Mujica_若葉睦_v2pp.pth')
    return {
      root,
      python: resolve(root, 'runtime', 'python.exe'),
      api: resolve(root, 'api_v2.py'),
      config: resolve(dataDir, 'audio', 'gpt-sovits-tts.yaml'),
      references: resolve(root, 'yinpin'),
      gptWeights,
      sovitsWeights,
      bert: resolve(root, 'GPT_SoVITS', 'pretrained_models', 'chinese-roberta-wwm-ext-large'),
      hubert: resolve(root, 'GPT_SoVITS', 'pretrained_models', 'chinese-hubert-base'),
      v2Pro: resolve(root, 'GPT_SoVITS', 'pretrained_models', 'v2Pro')
    }
  }

  private ensureConfigFile(): string {
    const paths = this.resolvePaths()
    mkdirSync(dirname(paths.config), { recursive: true })
    const yaml = [
      'custom:',
      `  bert_base_path: ${this.yamlPath(paths.bert)}`,
      `  cnhuhbert_base_path: ${this.yamlPath(paths.hubert)}`,
      `  device: ${this.yamlPath(this.device)}`,
      `  is_half: ${String(this.config.get<string>('GPT_SOVITS_HALF', 'true').toLowerCase() === 'true')}`,
      `  t2s_weights_path: ${this.yamlPath(paths.gptWeights)}`,
      `  vits_weights_path: ${this.yamlPath(paths.sovitsWeights)}`,
      '  version: v2ProPlus',
      ''
    ].join('\n')
    writeFileSync(paths.config, yaml, 'utf8')
    return paths.config
  }

  private yamlPath(value: string): string { return `'${value.replaceAll('\\', '/').replaceAll("'", "''")}'` }

  private validateInstallation(): void {
    const paths = this.resolvePaths()
    const required: Array<[string, string]> = [
      [paths.root, 'GPT-SOVITS_ROOT'],
      [paths.python, 'runtime/python.exe'],
      [paths.api, 'api_v2.py'],
      [paths.gptWeights, 'GPT 权重'],
      [paths.sovitsWeights, 'SoVITS 权重'],
      [paths.bert, 'BERT 模型'],
      [paths.hubert, 'HuBERT 模型'],
      [paths.v2Pro, 'v2ProPlus 基础模型']
    ]
    const missing = required.filter(([path]) => !existsSync(path)).map(([, label]) => label)
    if (missing.length) throw new Error(`GPT-SoVITS 配置不完整，缺少：${missing.join('、')}`)
  }

  private async ensureReady(): Promise<void> {
    this.validateInstallation()
    if (await this.isApiReady()) return
    if (!this.startPromise) {
      this.startPromise = this.start().finally(() => { this.startPromise = null })
    }
    await this.startPromise
  }

  private async start(): Promise<void> {
    this.state = 'starting'
    this.lastError = null
    const paths = this.resolvePaths()
    const configPath = this.ensureConfigFile()
    this.child = spawn(paths.python, ['-I', paths.api, '-a', this.host, '-p', String(this.port), '-c', configPath], {
      cwd: paths.root,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      stdio: 'pipe',
      windowsHide: true
    })
    this.child.stdout.on('data', (data: Buffer) => this.logger.debug(`[GPT-SoVITS] ${data.toString().trim()}`))
    this.child.stderr.on('data', (data: Buffer) => this.logger.warn(`[GPT-SoVITS] ${data.toString().trim()}`))
    this.child.once('exit', (code, signal) => {
      this.logger.warn(`GPT-SoVITS exited code=${code ?? 'null'} signal=${signal ?? 'null'}`)
      if (this.state !== 'stopped') this.state = 'error'
      this.child = null
    })
    const deadline = Date.now() + this.startTimeout
    while (Date.now() < deadline) {
      if (await this.isApiReady()) { this.state = 'idle'; return }
      if (this.child.exitCode !== null) break
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 500))
    }
    throw new Error(`GPT-SoVITS 启动超时（${this.startTimeout}ms）`)
  }

  private async stop(): Promise<void> {
    this.state = 'stopped'
    const child = this.child
    this.child = null
    if (!child || child.killed) return
    child.kill()
  }

  private async isApiReady(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/openapi.json`, { signal: AbortSignal.timeout(1000) })
      return response.ok
    } catch { return false }
  }

  private async request(path: string, init: RequestInit, timeout: number): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try { return await fetch(`${this.baseUrl}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }, signal: controller.signal }) }
    catch (error) { if (error instanceof Error && error.name === 'AbortError') throw new Error(`GPT-SoVITS 请求超时（${timeout}ms）`); throw error }
    finally { clearTimeout(timer) }
  }

  private resolveReference(referenceId: string): string {
    if (!referenceId || basename(referenceId) !== referenceId || referenceId.includes('..') || isAbsolute(referenceId)) throw new Error('参考音频路径无效')
    const candidate = resolve(this.resolvePaths().references, referenceId)
    const root = resolve(this.resolvePaths().references)
    if (relative(root, candidate).startsWith('..') || !AUDIO_EXTENSIONS.has(extname(candidate).toLowerCase()) || !existsSync(candidate)) throw new Error('参考音频不存在或格式不支持')
    return candidate
  }
}
