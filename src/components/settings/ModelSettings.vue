<template>
  <div class="tab-content">
    <div class="section">
      <h3 class="section-title">预设模型</h3>
      <div class="preset-grid">
        <div
          v-for="preset in MODEL_PRESETS"
          :key="preset.model"
          :class="['preset-card', { active: settings.modelSettings.model === preset.model && settings.modelSettings.apiBaseUrl === preset.baseUrl }]"
          @click="applyPreset(preset)"
        >
          <div class="preset-name">{{ preset.label }}</div>
          <div class="preset-provider">{{ preset.provider }}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h3 class="section-title">API 配置</h3>
      <el-form label-position="top" size="default">
        <el-form-item label="API Base URL">
          <el-input
            v-model="settings.modelSettings.apiBaseUrl"
            placeholder="https://api.openai.com/v1"
          />
          <template #extra>
            <span class="form-hint">支持 OpenAI 兼容接口</span>
          </template>
        </el-form-item>

        <el-form-item label="API Key">
          <el-input
            v-model="settings.modelSettings.apiKey"
            type="password"
            show-password
            placeholder="sk-..."
          />
          <template #extra>
            <span class="form-hint">密钥仅存储在本地浏览器</span>
          </template>
        </el-form-item>
      </el-form>
    </div>

    <div class="section">
      <h3 class="section-title">模型参数</h3>
      <el-form label-position="top" size="default">
        <el-form-item label="模型名称">
          <el-input
            v-model="settings.modelSettings.model"
            placeholder="gpt-4o / deepseek-chat / qwen-plus"
          />
        </el-form-item>

        <el-form-item :label="`Temperature (${settings.modelSettings.temperature})`">
          <el-slider
            v-model="settings.modelSettings.temperature"
            :min="0" :max="2" :step="0.1" show-stops
          />
        </el-form-item>

        <el-form-item label="最大 Token 数">
          <el-input-number
            v-model="settings.modelSettings.maxTokens"
            :min="128" :max="8192" :step="128"
            controls-position="right"
          />
        </el-form-item>
      </el-form>
    </div>

    <div class="section actions">
      <el-button type="primary" @click="handleSave">保存配置</el-button>
      <el-button @click="handleReset">恢复默认</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '@/stores/settings.store'
import { MODEL_PRESETS } from '@/types/settings.types'
import type { ModelPreset } from '@/types/settings.types'

const settings = useSettingsStore()

function applyPreset(preset: ModelPreset): void {
  settings.applyPreset(preset)
}

function handleSave(): void {
  ElMessage.success('配置已保存')
}

function handleReset(): void {
  settings.resetSettings()
  ElMessage.info('已恢复默认配置')
}
</script>

<style scoped lang="scss">
.tab-content { padding: 0 16px 24px; }

.section { margin-bottom: 24px; }

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color-light);
}

.preset-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.preset-card {
  padding: 10px;
  border: 1px solid var(--border-color-medium);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;

  &:hover { border-color: var(--color-primary); }

  &.active { border-color: var(--color-primary); background: var(--bg-hover); }

  .preset-name { font-size: 13px; font-weight: 500; color: var(--text-primary); }
  .preset-provider { font-size: 11px; color: var(--text-tertiary); margin-top: 2px; text-transform: capitalize; }
}

.form-hint { font-size: 11px; color: var(--text-tertiary); }

.actions { display: flex; gap: 8px; padding-top: 8px; }
</style>
