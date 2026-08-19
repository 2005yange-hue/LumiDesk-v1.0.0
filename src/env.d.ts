/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface ElectronAPI {
  getAppVersion: () => Promise<string>
  getApiBaseUrl: () => Promise<{ url: string, error: string | null }>
  sendNotification: (title: string, body: string) => Promise<boolean>
  minimizeWindow: () => Promise<void>
  toggleMaximizeWindow: () => Promise<boolean>
  isWindowMaximized: () => Promise<boolean>
  closeWindow: () => Promise<void>
  onWindowMaximizedChange: (callback: (maximized: boolean) => void) => () => void
  getPetSnapshot: () => Promise<unknown>
  getPetModel: (preferredModelId?: string) => Promise<unknown>
  getLive2DCoreUrl: () => Promise<string>
  getLive2DRuntimeUrls: () => Promise<{ pixi: string, unsafeEval: string, plugin: string }>
  getPetExtensionPath: () => Promise<string>
  refreshPetModels: () => Promise<unknown>
  updatePetConfig: (patch: object) => Promise<unknown>
  setPetModelEnabled: (modelId: string, enabled: boolean) => Promise<unknown>
  movePetBy: (deltaX: number, deltaY: number) => Promise<boolean>
  resetPetPosition: () => Promise<unknown>
  openPetActionMenu: () => Promise<unknown>
  closePetActionMenu: () => Promise<unknown>
  setPetInputCapture: (enabled: boolean) => Promise<boolean>
  showPet: () => Promise<unknown>
  hidePet: () => Promise<unknown>
  openChatFromPet: () => Promise<void>
  voiceControl: (action: 'stop' | 'open-chat') => Promise<boolean>
  onVoiceControl: (callback: (action: unknown) => void) => () => void
  updatePetModelStatus: (modelId: string, status: 'READY' | 'LOADING' | 'FAILED', error?: string | null) => Promise<boolean>
  publishPetEvent: (event: unknown) => void
  onPetEvent: (callback: (event: unknown) => void) => () => void
  onPetConfigChanged: (callback: (config: unknown) => void) => () => void
  onPetLayoutChanged: (callback: (layout: unknown) => void) => () => void
  onPetCursorPosition: (callback: (position: unknown) => void) => () => void
  platform: string
}

interface Window {
  electronAPI?: ElectronAPI
}

