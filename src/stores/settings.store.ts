import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { ModelSettings } from '@/types/settings.types'
import { DEFAULT_MODEL_SETTINGS } from '@/types/settings.types'

const STORAGE_KEY = 'ai-companion-settings'

/**
 * 设置 Store
 * 开发阶段使用 localStorage 持久化，后续可迁移到后端
 */
export const useSettingsStore = defineStore('settings', () => {
  /** 当前选中的角色 ID（用于聊天） */
  const activeCharacterId = ref<string>(loadCharacterId())

  // ──── 状态 ────
  const modelSettings = ref<ModelSettings>(loadSettings())

  // ──── 自动持久化 ────
  watch(
    modelSettings,
    (val) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    },
    { deep: true }
  )

  // ──── 方法 ────

  function loadSettings(): ModelSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return { ...DEFAULT_MODEL_SETTINGS, ...JSON.parse(stored) }
      }
    } catch {
      // 解析失败，使用默认值
    }
    return { ...DEFAULT_MODEL_SETTINGS }
  }

  /** 更新模型配置 */
  function updateModelSettings(partial: Partial<ModelSettings>): void {
    modelSettings.value = { ...modelSettings.value, ...partial }
  }

  /** 应用预设 */
  function applyPreset(preset: { model: string; baseUrl: string }): void {
    modelSettings.value.model = preset.model
    modelSettings.value.apiBaseUrl = preset.baseUrl
  }

  /** 重置为默认 */
  function resetSettings(): void {
    modelSettings.value = { ...DEFAULT_MODEL_SETTINGS }
    localStorage.removeItem(STORAGE_KEY)
  }

  /** 设置活跃角色 */
  function setActiveCharacterId(id: string): void {
    activeCharacterId.value = id
    localStorage.setItem('ai-companion-char', id)
  }

  function loadCharacterId(): string {
    return localStorage.getItem('ai-companion-char') || ''
  }

  /** 获取当前配置（用于发送给后端） */
  function getModelConfig() {
    return {
      apiBaseUrl: modelSettings.value.apiBaseUrl,
      apiKey: modelSettings.value.apiKey,
      model: modelSettings.value.model,
      temperature: modelSettings.value.temperature,
      maxTokens: modelSettings.value.maxTokens
    }
  }

  return {
    modelSettings,
    activeCharacterId,
    updateModelSettings,
    applyPreset,
    resetSettings,
    setActiveCharacterId,
    getModelConfig
  }
})
