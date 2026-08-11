<template>
  <div class="settings-view">
    <div class="settings-header">
      <el-button text @click="$router.push('/')">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      <h2>设置</h2>
      <div class="spacer"></div>
    </div>

    <div class="settings-body">
      <el-tabs v-model="activeTab" class="settings-tabs">
        <el-tab-pane label="模型配置" name="model">
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
        </el-tab-pane>

        <el-tab-pane label="关于" name="about">
          <div class="tab-content">
            <div class="about-section">
              <p class="app-name">AI 桌面伙伴</p>
              <p class="app-version">版本 0.1.0</p>
              <p class="app-desc">基于多模态大语言模型与长期记忆机制的智能桌面虚拟伙伴系统</p>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '@/stores/settings.store'
import { MODEL_PRESETS } from '@/types/settings.types'
import type { ModelPreset } from '@/types/settings.types'

const settings = useSettingsStore()
const activeTab = ref('model')

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
.settings-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #fff;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid #ebeef5;
  -webkit-app-region: drag;

  h2 {
    flex: 1;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    text-align: center;
  }

  .spacer { width: 60px; }

  .el-button { -webkit-app-region: no-drag; }
}

.settings-body {
  flex: 1;
  overflow-y: auto;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #c0c4cc; border-radius: 2px; }
}

.settings-tabs {
  height: 100%;
  :deep(.el-tabs__header) { padding: 0 16px; margin: 0; }
}

.tab-content { padding: 0 16px 24px; }

.section { margin-bottom: 24px; }

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.preset-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.preset-card {
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover { border-color: #409eff; }

  &.active { border-color: #409eff; background: #ecf5ff; }

  .preset-name { font-size: 13px; font-weight: 500; color: #303133; }
  .preset-provider { font-size: 11px; color: #909399; margin-top: 2px; text-transform: capitalize; }
}

.form-hint { font-size: 11px; color: #909399; }

.actions { display: flex; gap: 8px; padding-top: 8px; }

.about-section {
  text-align: center;
  padding: 40px 0;

  .app-name { font-size: 18px; font-weight: 600; color: #303133; margin-bottom: 4px; }
  .app-version { font-size: 13px; color: #909399; margin-bottom: 16px; }
  .app-desc { font-size: 13px; color: #606266; line-height: 1.6; }
}
</style>
