/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface ElectronAPI {
  getAppVersion: () => Promise<string>
  platform: string
}

interface Window {
  electronAPI: ElectronAPI
}
