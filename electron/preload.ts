import { contextBridge, ipcRenderer } from 'electron'

/**
 * 预加载脚本 - 安全暴露 Electron API 给渲染进程
 * 后续阶段按需扩展：截图、通知、文件系统等
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取应用版本
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // 平台信息
  platform: process.platform,

  // 预留：屏幕截图（阶段五实现）
  // captureScreen: () => ipcRenderer.invoke('capture-screen'),

  // 预留：系统通知（阶段六实现）
  // sendNotification: (title: string, body: string) =>
  //   ipcRenderer.invoke('send-notification', title, body),
})
