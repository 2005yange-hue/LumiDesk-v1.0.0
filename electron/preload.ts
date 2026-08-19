import { contextBridge, ipcRenderer } from 'electron'

interface PetConfigPayload {
  enabled: boolean
  modelId: string
  scale: number
  position: { x: number, y: number } | null
  alwaysOnTop: boolean
  disabledModelIds: string[]
}

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getApiBaseUrl: () => ipcRenderer.invoke('get-api-base-url'),
  sendNotification: (title: string, body: string) => ipcRenderer.invoke('send-notification', title, body),
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window-toggle-maximize'),
  isWindowMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  onWindowMaximizedChange: (callback: (maximized: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, maximized: boolean) => callback(maximized)
    ipcRenderer.on('window-maximized-change', listener)
    return () => ipcRenderer.removeListener('window-maximized-change', listener)
  },
  getPetSnapshot: () => ipcRenderer.invoke('pet:get-snapshot'),
  getPetModel: (preferredModelId?: string) => ipcRenderer.invoke('pet:get-model', preferredModelId),
  getLive2DCoreUrl: () => ipcRenderer.invoke('pet:get-core-url'),
  getLive2DRuntimeUrls: () => ipcRenderer.invoke('pet:get-runtime-urls'),
  getPetExtensionPath: () => ipcRenderer.invoke('pet:get-extension-path'),
  refreshPetModels: () => ipcRenderer.invoke('pet:refresh-models'),
  updatePetConfig: (patch: Partial<PetConfigPayload>) => ipcRenderer.invoke('pet:update-config', patch),
  setPetModelEnabled: (modelId: string, enabled: boolean) => ipcRenderer.invoke('pet:set-model-enabled', modelId, enabled),
  movePetBy: (deltaX: number, deltaY: number) => ipcRenderer.invoke('pet:move-by', deltaX, deltaY),
  resetPetPosition: () => ipcRenderer.invoke('pet:reset-position'),
  openPetActionMenu: () => ipcRenderer.invoke('pet:open-action-menu'),
  closePetActionMenu: () => ipcRenderer.invoke('pet:close-action-menu'),
  setPetInputCapture: (enabled: boolean) => ipcRenderer.invoke('pet:set-input-capture', enabled),
  showPet: () => ipcRenderer.invoke('pet:show'),
  hidePet: () => ipcRenderer.invoke('pet:hide'),
  openChatFromPet: () => ipcRenderer.invoke('pet:open-chat'),
  voiceControl: (action: 'stop' | 'open-chat') => ipcRenderer.invoke('pet:voice-control', action),
  onVoiceControl: (callback: (action: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: unknown) => callback(action)
    ipcRenderer.on('voice-control', listener)
    return () => ipcRenderer.removeListener('voice-control', listener)
  },
  updatePetModelStatus: (modelId: string, status: 'READY' | 'LOADING' | 'FAILED', error?: string | null) => ipcRenderer.invoke('pet:update-model-status', modelId, status, error),
  publishPetEvent: (event: unknown) => ipcRenderer.send('pet:publish', event),
  onPetEvent: (callback: (event: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, petEvent: unknown) => callback(petEvent)
    ipcRenderer.on('pet:event', listener)
    return () => ipcRenderer.removeListener('pet:event', listener)
  },
  onPetConfigChanged: (callback: (config: PetConfigPayload) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, config: PetConfigPayload) => callback(config)
    ipcRenderer.on('pet:config-changed', listener)
    return () => ipcRenderer.removeListener('pet:config-changed', listener)
  },
  onPetLayoutChanged: (callback: (layout: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, layout: unknown) => callback(layout)
    ipcRenderer.on('pet:layout-changed', listener)
    return () => ipcRenderer.removeListener('pet:layout-changed', listener)
  },
  onPetCursorPosition: (callback: (position: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, position: unknown) => callback(position)
    ipcRenderer.on('pet:cursor-position', listener)
    return () => ipcRenderer.removeListener('pet:cursor-position', listener)
  },
  platform: process.platform
})

