import { app, BrowserWindow, ipcMain, Notification, screen } from 'electron'
import { existsSync } from 'fs'
import { isAbsolute, join, relative } from 'path'
import { pathToFileURL } from 'url'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { ModelRegistry, type ModelStatus, type ModelSource } from './model-registry'
import { PetConfigStore, type PetConfig } from './pet-config'

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const PET_WIDTH = 460
const PET_HEIGHT = 620
const PET_MIN_SCALE = 0.6
const PET_MAX_SCALE = 1.5
const PET_MENU_WIDTH = 252
const PET_MENU_HEIGHT = 520
const PET_MENU_GAP = 6
const PET_EVENT_TYPES = new Set([
  'chat_start', 'chat_delta', 'chat_complete', 'chat_error',
  'character_changed', 'character_state', 'emotion_change',
  'relationship_up', 'interaction', 'chat_phase', 'notification',
  'voice_start', 'voice_amplitude', 'voice_complete', 'voice_stop', 'voice_error', 'voice_fallback'
])

interface PetEvent {
  type: string
  payload: Record<string, unknown>
}

type PetMenuSide = 'left' | 'right'

interface PetWindowLayout {
  menuOpen: boolean
  menuSide: PetMenuSide
  modelWidth: number
  modelHeight: number
  menuWidth: number
  menuHeight: number
  menuGap: number
  shellWidth: number
  shellHeight: number
}

let mainWindow: BrowserWindow | null = null
let petWindow: BrowserWindow | null = null
let registry: ModelRegistry | null = null
let petConfigStore: PetConfigStore | null = null
let lastCharacterEvent: PetEvent | null = null
let persistPositionTimer: NodeJS.Timeout | null = null
let petMenuOpen = false
let petMenuSide: PetMenuSide = 'left'
let petCursorTimer: NodeJS.Timeout | null = null
let backendProcess: ChildProcess | null = null
let backendBaseUrl = 'http://127.0.0.1:3000'
let backendStartupError: string | null = null

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

function getBundledModelsRoot(): string {
  return app.isPackaged ? join(process.resourcesPath, 'live2d') : join(app.getAppPath(), 'resources', 'live2d')
}

function getCorePath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'live2d-runtime', 'live2dcubismcore.min.js')
    : join(app.getAppPath(), 'resources', 'live2d-runtime', 'live2dcubismcore.min.js')
}

function getRendererResourceUrl(resourcePath: string): string {
  if (VITE_DEV_SERVER_URL) {
    const relativePath = relative(join(app.getAppPath(), 'resources'), resourcePath)
    if (relativePath && !relativePath.startsWith('..') && !isAbsolute(relativePath)) {
      return new URL(relativePath.replaceAll('\\', '/'), `${VITE_DEV_SERVER_URL.replace(/\/$/, '')}/`).toString()
    }
  }
  return pathToFileURL(resourcePath).toString()
}

function getPetDevUrl(): string {
  if (!VITE_DEV_SERVER_URL) return ''
  const url = new URL(VITE_DEV_SERVER_URL)
  url.searchParams.set('debug', '1')
  url.hash = '/pet'
  return url.toString()
}

function getPackagedGptSovitsRoot(): string | undefined {
  if (process.env.GPT_SOVITS_ROOT) return process.env.GPT_SOVITS_ROOT
  if (!app.isPackaged) return undefined

  // Portable builds live beside the project model directory. Installed builds
  // can still override this with GPT_SOVITS_ROOT when the model is external.
  const candidates = [
    join(process.resourcesPath, '..', '..', 'GPT-SoVITS-v2pro-20250604'),
    join(process.resourcesPath, '..', 'GPT-SoVITS-v2pro-20250604')
  ]
  return candidates.find((candidate) => existsSync(candidate))
}

function getPetConfig(): PetConfig {
  return petConfigStore?.get() ?? new PetConfigStore().load()
}

function canBindPort(port: number): Promise<boolean> {
  return new Promise((resolvePort) => {
    const probe = createServer()
    probe.once('error', () => resolvePort(false))
    probe.once('listening', () => probe.close(() => resolvePort(true)))
    probe.listen(port, '127.0.0.1')
  })
}

async function findBackendPort(start = 3000): Promise<number> {
  for (let offset = 0; offset < 20; offset += 1) {
    const port = start + offset
    if (await canBindPort(port)) return port
  }
  throw new Error('没有可用的本地后端端口（已检查 3000-3019）')
}

async function waitForBackend(baseUrl: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (backendProcess?.exitCode !== null && backendProcess?.exitCode !== undefined) {
      throw new Error(`后端进程提前退出（code=${backendProcess.exitCode}）`)
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1000) })
      if (response.ok) return
    } catch {
      // 后端可能仍在加载 TypeORM 和 migration。
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
  }
  throw new Error(`后端健康检查超时（${timeoutMs}ms）`)
}

async function startBackendServer(): Promise<void> {
  if (!app.isPackaged) {
    backendBaseUrl = 'http://127.0.0.1:3000'
    process.env.LUMIDESK_API_BASE_URL = backendBaseUrl
    return
  }

  const port = await findBackendPort()
  const serverRoot = join(process.resourcesPath, 'server')
  const entry = join(serverRoot, 'dist', 'main.js')
  if (!existsSync(entry)) throw new Error(`安装包缺少后端文件：${entry}`)

  const dataDir = join(app.getPath('userData'), 'data')
  const gptSovitsRoot = getPackagedGptSovitsRoot()
  backendBaseUrl = `http://127.0.0.1:${port}`
  process.env.LUMIDESK_API_BASE_URL = backendBaseUrl
  backendProcess = spawn(process.execPath, [entry], {
    cwd: serverRoot,
    windowsHide: true,
    stdio: 'pipe',
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      SERVER_HOST: '127.0.0.1',
      SERVER_PORT: String(port),
      DATABASE_TYPE: 'sqlite',
      DATABASE_MIGRATIONS_RUN: 'true',
      DATABASE_SYNCHRONIZE: 'false',
      VECTOR_DB_PROVIDER: 'disabled',
      LUMIDESK_DATA_DIR: dataDir,
      SQLITE_PATH: join(dataDir, 'lumidesk.sqlite'),
      ...(gptSovitsRoot ? { GPT_SOVITS_ROOT: gptSovitsRoot } : {})
    }
  })
  backendProcess.stdout?.on('data', (data: Buffer) => console.log(`[backend] ${data.toString().trim()}`))
  backendProcess.stderr?.on('data', (data: Buffer) => console.error(`[backend] ${data.toString().trim()}`))
  backendProcess.once('error', (error) => { backendStartupError = error.message })
  backendProcess.once('exit', (code, signal) => {
    if (code !== 0 && code !== null) backendStartupError = `后端进程退出 code=${code} signal=${signal || 'none'}`
    backendProcess = null
  })
  await waitForBackend(backendBaseUrl)
}

function stopBackendServer(): void {
  const child = backendProcess
  backendProcess = null
  if (!child || child.killed) return
  child.kill()
}

function refreshRegistry() {
  if (!registry) return []
  return registry.reload(getPetConfig().disabledModelIds)
}

function createMainWindow(): void {
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    center: true,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    skipTaskbar: false,
    webPreferences: { preload: join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: false }
  })
  mainWindow = window

  window.on('maximize', () => window.webContents.send('window-maximized-change', true))
  window.on('unmaximize', () => window.webContents.send('window-maximized-change', false))
  window.on('closed', () => { if (mainWindow === window) mainWindow = null })

  if (VITE_DEV_SERVER_URL) void window.loadURL(VITE_DEV_SERVER_URL)
  else void window.loadFile(join(__dirname, '../dist/index.html'))
}

function clampPetScale(scale: number): number {
  return Math.min(PET_MAX_SCALE, Math.max(PET_MIN_SCALE, scale))
}

function getPetWindowSize(scale: number): { width: number, height: number } {
  const normalizedScale = clampPetScale(scale)
  return {
    width: Math.round(PET_WIDTH * normalizedScale),
    height: Math.round(PET_HEIGHT * normalizedScale)
  }
}

function getPetWindowLayout(scale: number, menuOpen = petMenuOpen, menuSide = petMenuSide): PetWindowLayout {
  const normalizedScale = clampPetScale(scale)
  const modelSize = getPetWindowSize(normalizedScale)
  const menuWidth = PET_MENU_WIDTH
  const menuHeight = PET_MENU_HEIGHT
  const menuGap = Math.max(1, Math.round(PET_MENU_GAP * normalizedScale))
  return {
    menuOpen,
    menuSide,
    modelWidth: modelSize.width,
    modelHeight: modelSize.height,
    menuWidth,
    menuHeight,
    menuGap,
    shellWidth: modelSize.width + menuWidth + menuGap,
    shellHeight: Math.max(modelSize.height, menuHeight)
  }
}

function getSafePetModelPosition(position: { x: number, y: number } | null, scale: number): { x: number, y: number } {
  const modelSize = getPetWindowSize(scale)
  const layout = getPetWindowLayout(scale)
  const primaryDisplay = screen.getPrimaryDisplay()
  const fallbackPoint = {
    x: primaryDisplay.workArea.x + primaryDisplay.workArea.width - modelSize.width - 28,
    y: primaryDisplay.workArea.y + primaryDisplay.workArea.height - modelSize.height - 54
  }
  const target = position ?? fallbackPoint
  const display = screen.getDisplayNearestPoint(target)
  const { x, y, width, height } = display.workArea
  const menuOffset = layout.menuSide === 'left' ? layout.menuWidth + layout.menuGap : 0
  const maxX = Math.max(x + menuOffset, x + width - modelSize.width)
  const maxY = Math.max(y + layout.shellHeight - modelSize.height, y + height - modelSize.height)
  return {
    x: Math.round(Math.min(maxX, Math.max(x + menuOffset, target.x))),
    y: Math.round(Math.min(maxY, Math.max(y + layout.shellHeight - modelSize.height, target.y)))
  }
}

function getPetShellBounds(modelPosition: { x: number, y: number }, scale: number): { x: number, y: number, width: number, height: number } {
  const layout = getPetWindowLayout(scale)
  return {
    x: modelPosition.x - (layout.menuSide === 'left' ? layout.menuWidth + layout.menuGap : 0),
    y: modelPosition.y - (layout.shellHeight - layout.modelHeight),
    width: layout.shellWidth,
    height: layout.shellHeight
  }
}

function getPetModelBounds(window: BrowserWindow, scale: number): { x: number, y: number, width: number, height: number } {
  const layout = getPetWindowLayout(scale)
  const bounds = window.getBounds()
  return {
    x: bounds.x + (layout.menuSide === 'left' ? layout.menuWidth + layout.menuGap : 0),
    y: bounds.y + layout.shellHeight - layout.modelHeight,
    width: layout.modelWidth,
    height: layout.modelHeight
  }
}

function broadcastPetLayout(layout = getPetWindowLayout(getPetConfig().scale)): void {
  if (petWindow && !petWindow.isDestroyed()) petWindow.webContents.send('pet:layout-changed', layout)
}

function startPetCursorBroadcast(): void {
  if (petCursorTimer) return
  petCursorTimer = setInterval(() => {
    const window = petWindow
    if (!window || window.isDestroyed() || !window.isVisible()) return
    const bounds = window.getBounds()
    const cursor = screen.getCursorScreenPoint()
    window.webContents.send('pet:cursor-position', {
      x: cursor.x - bounds.x,
      y: cursor.y - bounds.y,
      width: bounds.width,
      height: bounds.height,
      inside: cursor.x >= bounds.x && cursor.x <= bounds.x + bounds.width && cursor.y >= bounds.y && cursor.y <= bounds.y + bounds.height
    })
  }, 40)
}

function stopPetCursorBroadcast(): void {
  if (!petCursorTimer) return
  clearInterval(petCursorTimer)
  petCursorTimer = null
}

function applyPetWindowLayout(window: BrowserWindow, modelBounds: { x: number, y: number, width: number, height: number }, menuOpen: boolean, preferredSide?: PetMenuSide): PetWindowLayout {
  petMenuOpen = menuOpen
  if (preferredSide) petMenuSide = preferredSide
  const layout = getPetWindowLayout(getPetConfig().scale)
  const safeModelPosition = getSafePetModelPosition(modelBounds, getPetConfig().scale)
  window.setBounds(getPetShellBounds(safeModelPosition, getPetConfig().scale))
  broadcastPetLayout(layout)
  return layout
}

function resizePetWindow(window: BrowserWindow, previousScale: number, nextScale: number): void {
  if (window.isDestroyed()) return
  const previousModelBounds = getPetModelBounds(window, previousScale)
  const previousSize = getPetWindowSize(previousScale)
  const nextSize = getPetWindowSize(nextScale)
  const nextModelBounds = {
    x: previousModelBounds.x - Math.round((nextSize.width - previousSize.width) / 2),
    y: previousModelBounds.y - (nextSize.height - previousSize.height),
    width: nextSize.width,
    height: nextSize.height
  }
  applyPetWindowLayout(window, nextModelBounds, petMenuOpen, petMenuSide)
}

function createPetWindow(): void {
  const config = getPetConfig()
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.setAlwaysOnTop(config.alwaysOnTop, 'screen-saver')
    if (config.enabled) petWindow.showInactive()
    return
  }

  petMenuOpen = false
  const layout = getPetWindowLayout(config.scale, false)
  const modelPosition = getSafePetModelPosition(config.position, config.scale)
  const window = new BrowserWindow({
    width: layout.shellWidth,
    height: layout.shellHeight,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    alwaysOnTop: config.alwaysOnTop,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: { preload: join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: false }
  })
  petWindow = window
  startPetCursorBroadcast()
  const shellBounds = getPetShellBounds(modelPosition, config.scale)
  window.setBounds(shellBounds)

  if (!app.isPackaged) {
    window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      if (message.includes('[Pet]') || level >= 2) console.error(`[pet renderer:${level}] ${message} (${sourceId}:${line})`)
    })
    window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error(`[pet renderer] 页面加载失败 ${errorCode}: ${errorDescription} (${validatedURL})`)
    })
    window.webContents.on('render-process-gone', (_event, details) => {
      console.error(`[pet renderer] 渲染进程已退出: ${details.reason}`)
    })
  }

  window.on('move', () => schedulePersistPetPosition(window))
  window.on('closed', () => { if (petWindow === window) { petWindow = null; stopPetCursorBroadcast() } })
  window.once('ready-to-show', () => {
    if (getPetConfig().enabled) window.showInactive()
    window.setIgnoreMouseEvents(true, { forward: true })
  })

  if (VITE_DEV_SERVER_URL) void window.loadURL(getPetDevUrl())
  else void window.loadFile(join(__dirname, '../dist/index.html'), { hash: '/pet' })
}

function schedulePersistPetPosition(window: BrowserWindow): void {
  if (persistPositionTimer) clearTimeout(persistPositionTimer)
  persistPositionTimer = setTimeout(() => {
    if (window.isDestroyed() || !petConfigStore) return
    const modelBounds = getPetModelBounds(window, getPetConfig().scale)
    petConfigStore.update({ position: { x: modelBounds.x, y: modelBounds.y } })
  }, 250)
}

function broadcastPetConfig(config: PetConfig): void {
  if (petWindow && !petWindow.isDestroyed()) petWindow.webContents.send('pet:config-changed', config)
}

function showPet(): PetConfig {
  const config = petConfigStore?.update({ enabled: true }) ?? getPetConfig()
  createPetWindow()
  petWindow?.showInactive()
  broadcastPetConfig(config)
  return config
}

function hidePet(): PetConfig {
  const config = petConfigStore?.update({ enabled: false }) ?? getPetConfig()
  petWindow?.hide()
  broadcastPetConfig(config)
  return config
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) createMainWindow()
  mainWindow?.show()
  mainWindow?.focus()
}

function getSenderWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

function isMainSender(event: Electron.IpcMainEvent): boolean {
  return event.sender === mainWindow?.webContents
}

function isPetSender(event: Electron.IpcMainInvokeEvent): boolean {
  return event.sender === petWindow?.webContents
}

function isPetEvent(value: unknown): value is PetEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Record<string, unknown>
  if (typeof event.type !== 'string' || !PET_EVENT_TYPES.has(event.type)) return false
  if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) return false
  return JSON.stringify(event).length <= 24_000
}

function getResolvedModel(preferredModelId?: unknown) {
  if (!registry) return null
  const config = getPetConfig()
  const available = registry.list(config.disabledModelIds).filter((model) => model.status === 'READY' || model.status === 'FAILED')
  const requested = typeof preferredModelId === 'string' ? preferredModelId : null
  const selected = requested && available.some((model) => model.id === requested)
    ? requested
    : available.some((model) => model.id === config.modelId)
      ? config.modelId
      : registry.getDefaultId(config.disabledModelIds)
  if (!selected) return null
  const manifest = registry.getManifest(selected)
  const modelPath = registry.resolveModelPath(selected)
  const modelUrl = modelPath ? getRendererResourceUrl(modelPath) : null
  return manifest && modelUrl ? { modelId: selected, manifest, modelUrl } : null
}

app.whenReady().then(async () => {
  petConfigStore = new PetConfigStore()
  petConfigStore.load()
  registry = new ModelRegistry(getBundledModelsRoot(), join(app.getPath('userData'), 'live2d-models'))
  refreshRegistry()
  try {
    await startBackendServer()
  } catch (error) {
    backendStartupError = error instanceof Error ? error.message : String(error)
    console.error(`[backend] ${backendStartupError}`)
  }
  createMainWindow()
  if (getPetConfig().enabled) createPetWindow()

  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) createMainWindow()
    if (getPetConfig().enabled) createPetWindow()
  })
})

app.on('second-instance', () => {
  if (app.isReady()) showMainWindow()
})

app.on('window-all-closed', () => { stopPetCursorBroadcast(); if (process.platform !== 'darwin') app.quit() })
app.on('will-quit', stopBackendServer)

ipcMain.handle('get-app-version', () => app.getVersion())
ipcMain.handle('get-api-base-url', () => ({ url: backendBaseUrl, error: backendStartupError }))
ipcMain.handle('send-notification', (_event, title: string, body: string) => {
  if (!Notification.isSupported()) return false
  new Notification({ title, body }).show()
  return true
})
ipcMain.handle('window-minimize', (event) => getSenderWindow(event)?.minimize())
ipcMain.handle('window-toggle-maximize', (event) => {
  const window = getSenderWindow(event)
  if (!window) return false
  if (window.isMaximized()) window.unmaximize()
  else window.maximize()
  return window.isMaximized()
})
ipcMain.handle('window-is-maximized', (event) => getSenderWindow(event)?.isMaximized() ?? false)
ipcMain.handle('window-close', (event) => getSenderWindow(event)?.close())

ipcMain.handle('pet:get-snapshot', () => ({
  config: getPetConfig(),
  layout: getPetWindowLayout(getPetConfig().scale),
  models: registry?.list(getPetConfig().disabledModelIds) ?? [],
  characterEvent: lastCharacterEvent
}))
ipcMain.handle('pet:get-model', (_event, preferredModelId?: unknown) => getResolvedModel(preferredModelId))
ipcMain.handle('pet:get-core-url', () => getRendererResourceUrl(getCorePath()))
ipcMain.handle('pet:get-runtime-urls', () => ({
  pixi: getRendererResourceUrl(join(app.isPackaged ? join(process.resourcesPath, 'live2d-runtime') : join(app.getAppPath(), 'resources', 'live2d-runtime'), 'pixi.min.js')),
  unsafeEval: getRendererResourceUrl(join(app.isPackaged ? join(process.resourcesPath, 'live2d-runtime') : join(app.getAppPath(), 'resources', 'live2d-runtime'), 'pixi-unsafe-eval.min.js')),
  plugin: getRendererResourceUrl(join(app.isPackaged ? join(process.resourcesPath, 'live2d-runtime') : join(app.getAppPath(), 'resources', 'live2d-runtime'), 'pixi-live2d-cubism4.min.js'))
}))
ipcMain.handle('pet:get-extension-path', () => join(app.getPath('userData'), 'live2d-models'))
ipcMain.handle('pet:refresh-models', () => refreshRegistry())
ipcMain.handle('pet:update-config', (_event, patch: Partial<PetConfig>) => {
  const previousConfig = getPetConfig()
  const allowed: Partial<PetConfig> = {}
  if (typeof patch?.enabled === 'boolean') allowed.enabled = patch.enabled
  if (typeof patch?.alwaysOnTop === 'boolean') allowed.alwaysOnTop = patch.alwaysOnTop
  if (typeof patch?.scale === 'number' && Number.isFinite(patch.scale)) allowed.scale = patch.scale
  if (typeof patch?.modelId === 'string' && /^[a-z0-9_-]{1,64}$/i.test(patch.modelId)) allowed.modelId = patch.modelId
  const config = petConfigStore?.update(allowed) ?? getPetConfig()
  if (petWindow && !petWindow.isDestroyed()) resizePetWindow(petWindow, previousConfig.scale, config.scale)
  petWindow?.setAlwaysOnTop(config.alwaysOnTop, 'screen-saver')
  if (config.enabled) showPet()
  else hidePet()
  broadcastPetConfig(config)
  return config
})
ipcMain.handle('pet:set-model-enabled', (_event, modelId: unknown, enabled: unknown) => {
  if (typeof modelId !== 'string' || typeof enabled !== 'boolean' || !registry?.getManifest(modelId)) return getPetConfig()
  const current = new Set(getPetConfig().disabledModelIds)
  if (enabled) current.delete(modelId)
  else current.add(modelId)
  const config = petConfigStore?.update({ disabledModelIds: [...current] }) ?? getPetConfig()
  broadcastPetConfig(config)
  return config
})
ipcMain.handle('pet:move-by', (event, deltaX: unknown, deltaY: unknown) => {
  if (!isPetSender(event) || typeof deltaX !== 'number' || typeof deltaY !== 'number' || Math.abs(deltaX) > 320 || Math.abs(deltaY) > 320 || !petWindow) return false
  const [x, y] = petWindow.getPosition()
  petWindow.setPosition(Math.round(x + deltaX), Math.round(y + deltaY))
  return true
})
ipcMain.handle('pet:reset-position', () => {
  if (!petWindow) createPetWindow()
  if (petWindow && !petWindow.isDestroyed()) {
    const scale = getPetConfig().scale
    petWindow.setBounds(getPetShellBounds(getSafePetModelPosition(null, scale), scale))
  }
  return getPetConfig()
})
ipcMain.handle('pet:open-action-menu', (event) => {
  if (!isPetSender(event) || !petWindow || petWindow.isDestroyed()) return null
  petMenuOpen = true
  const layout = getPetWindowLayout(getPetConfig().scale)
  broadcastPetLayout(layout)
  petWindow.setIgnoreMouseEvents(false)
  return layout
})
ipcMain.handle('pet:close-action-menu', (event) => {
  if (!isPetSender(event) || !petWindow || petWindow.isDestroyed()) return null
  petMenuOpen = false
  const layout = getPetWindowLayout(getPetConfig().scale)
  broadcastPetLayout(layout)
  petWindow.setIgnoreMouseEvents(true, { forward: true })
  return layout
})
ipcMain.handle('pet:set-input-capture', (event, enabled: unknown) => {
  if (!isPetSender(event) || typeof enabled !== 'boolean' || !petWindow || petWindow.isDestroyed()) return false
  petWindow.setIgnoreMouseEvents(petMenuOpen ? false : !enabled, { forward: !petMenuOpen && !enabled })
  return true
})
ipcMain.handle('pet:show', () => showPet())
ipcMain.handle('pet:hide', () => hidePet())
ipcMain.handle('pet:open-chat', () => showMainWindow())
ipcMain.handle('pet:voice-control', (event, action: unknown) => {
  if (!isPetSender(event) || (action !== 'stop' && action !== 'open-chat')) return false
  if (action === 'open-chat') showMainWindow()
  else mainWindow?.webContents.send('voice-control', action)
  return true
})
ipcMain.handle('pet:update-model-status', (event, modelId: unknown, status: unknown, error: unknown) => {
  if (!isPetSender(event) || typeof modelId !== 'string' || (status !== 'READY' && status !== 'LOADING' && status !== 'FAILED')) return false
  registry?.setRuntimeStatus(modelId, status as Extract<ModelStatus, 'READY' | 'LOADING' | 'FAILED'>, typeof error === 'string' ? error.slice(0, 500) : null)
  return true
})

ipcMain.on('pet:publish', (event, petEvent: unknown) => {
  if (!isMainSender(event) || !isPetEvent(petEvent)) return
  if (petEvent.type === 'character_changed') lastCharacterEvent = petEvent
  if (petWindow && !petWindow.isDestroyed()) petWindow.webContents.send('pet:event', petEvent)
})

