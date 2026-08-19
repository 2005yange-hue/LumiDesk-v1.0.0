<template>
  <div class="pet-settings tab-content">
    <section class="section">
      <div class="section-header">
        <div>
          <h3 class="section-title">桌宠与角色形象</h3>
          <p>桌宠只负责展示，不会修改聊天、记忆、情绪、关系或提醒数据。</p>
        </div>
        <el-button size="small" plain :disabled="loading" @click="load">刷新模型</el-button>
      </div>

      <template v-if="isElectron">
        <div class="settings-card">
          <div class="setting-row">
            <div><strong>显示桌宠</strong><span>独立透明窗口；右键模型可打开对话、缩放和更多设置。</span></div>
            <el-switch v-model="config.enabled" :disabled="saving" @change="save({ enabled: config.enabled })" />
          </div>
          <div class="setting-row">
            <div><strong>始终置顶</strong><span>关闭后桌宠仍保留在桌面，但可被其他窗口遮挡。</span></div>
            <el-switch v-model="config.alwaysOnTop" :disabled="saving" @change="save({ alwaysOnTop: config.alwaysOnTop })" />
          </div>
          <div class="setting-field">
            <strong>全局默认形象</strong>
            <el-select v-model="config.modelId" :disabled="saving || readyModels.length === 0" @change="save({ modelId: config.modelId })">
              <el-option v-for="model in readyModels" :key="model.id" :label="`${model.name} · ${model.version}`" :value="model.id" />
            </el-select>
            <span>未在角色资料中指定形象的角色将继承此模型。</span>
          </div>
          <div class="setting-field">
            <div class="setting-slider-label"><strong>桌宠缩放</strong><span>{{ Math.round(config.scale * 100) }}%</span></div>
            <el-slider v-model="config.scale" :min="0.6" :max="1.5" :step="0.05" :disabled="saving" @change="save({ scale: config.scale })" />
          </div>
          <div class="setting-actions">
            <el-button plain :disabled="saving" @click="resetPosition">重置桌宠位置</el-button>
            <el-button plain :disabled="saving" @click="save({ scale: 1 })">重置缩放</el-button>
            <el-button type="primary" plain :disabled="saving" @click="showPet">显示桌宠</el-button>
            <el-button type="danger" plain :disabled="saving" @click="hidePet">隐藏桌宠</el-button>
          </div>
        </div>

        <div class="model-heading">
          <div><h4>模型注册表</h4><span>状态来自元数据校验与桌宠运行时加载结果。</span></div>
          <el-tag size="small" effect="plain">{{ models.length }} 个发现模型</el-tag>
        </div>
        <div v-if="models.length" class="model-list">
          <article v-for="model in models" :key="`${model.source}-${model.id}`" class="model-card">
            <div class="model-title"><strong>{{ model.name }}</strong><el-tag size="small" :type="statusType(model.status)">{{ statusLabel(model.status) }}</el-tag></div>
            <span>{{ model.id }} · {{ model.version }} · {{ model.source === 'bundled' ? '内置' : '开发者扩展' }}</span>
            <p v-if="model.error" class="model-error">{{ model.error }}</p>
            <p v-else>动作：{{ model.capabilities.motions.join('、') || '未声明' }}</p>
            <div class="model-actions">
              <el-switch :model-value="model.status !== 'DISABLED'" :disabled="saving || model.status === 'INVALID'" active-text="启用" inactive-text="禁用" @change="(enabled: boolean) => setModelEnabled(model.id, enabled)" />
            </div>
          </article>
        </div>
        <el-empty v-else description="未发现可用模型" :image-size="64" />

        <div class="developer-note">
          <strong>开发者手动添加模型</strong>
          <p>开发模式将模型目录放入项目 `resources/live2d/&lt;modelId&gt;/`；已安装应用可放入以下目录后点击“刷新模型”。每个目录必须包含 `model.json` 与模型运行时资源。</p>
          <code>{{ extensionPath || '正在读取扩展模型目录…' }}</code>
        </div>
      </template>
      <el-empty v-else description="桌宠与模型管理仅在 Electron 桌面端可用" :image-size="72" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { ModelStatus, PetConfig, PetSnapshot, RegisteredModel } from '@/live2d/live2d.types'

const isElectron = Boolean(window.electronAPI)
const loading = ref(false)
const saving = ref(false)
const models = ref<RegisteredModel[]>([])
const extensionPath = ref('')
const config = reactive<PetConfig>({ enabled: true, modelId: 'hiyori_free', scale: 1, position: null, alwaysOnTop: true, disabledModelIds: [] })
const readyModels = computed(() => models.value.filter((model) => model.status === 'READY'))

const STATUS_LABELS: Record<ModelStatus, string> = { READY: '可用', INVALID: '无效', LOADING: '加载中', FAILED: '加载失败', DISABLED: '已禁用' }
function statusLabel(status: ModelStatus): string { return STATUS_LABELS[status] }
function statusType(status: ModelStatus): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'READY') return 'success'
  if (status === 'FAILED' || status === 'INVALID') return 'danger'
  if (status === 'LOADING') return 'warning'
  return 'info'
}

function applySnapshot(snapshot: PetSnapshot): void {
  Object.assign(config, snapshot.config)
  models.value = snapshot.models
}

async function load(): Promise<void> {
  if (!window.electronAPI) return
  loading.value = true
  try {
    await window.electronAPI.refreshPetModels()
    applySnapshot(await window.electronAPI.getPetSnapshot() as PetSnapshot)
    extensionPath.value = await window.electronAPI.getPetExtensionPath()
  } catch {
    ElMessage.error('无法读取桌宠设置或模型注册表')
  } finally {
    loading.value = false
  }
}

async function save(patch: Partial<PetConfig>): Promise<void> {
  if (!window.electronAPI) return
  saving.value = true
  try {
    Object.assign(config, await window.electronAPI.updatePetConfig(patch) as PetConfig)
    models.value = (await window.electronAPI.getPetSnapshot() as PetSnapshot).models
  } catch {
    ElMessage.error('桌宠设置保存失败')
  } finally {
    saving.value = false
  }
}

async function setModelEnabled(modelId: string, enabled: boolean): Promise<void> {
  if (!window.electronAPI) return
  saving.value = true
  try {
    await window.electronAPI.setPetModelEnabled(modelId, enabled)
    await load()
  } catch {
    ElMessage.error('模型状态更新失败')
  } finally {
    saving.value = false
  }
}

async function resetPosition(): Promise<void> {
  await window.electronAPI?.resetPetPosition()
  ElMessage.success('桌宠位置已重置')
}
async function showPet(): Promise<void> { await window.electronAPI?.showPet() }
async function hidePet(): Promise<void> { await window.electronAPI?.hidePet() }

onMounted(() => { void load() })
</script>

<style scoped lang="scss">
.tab-content { padding: 0 16px 24px; }
.section-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.section-title { margin: 0 0 5px; color: var(--text-primary); font-size: 14px; }
.section-header p, .setting-row span, .setting-field > span, .model-heading span, .developer-note p { margin: 0; color: var(--text-tertiary); font-size: 12px; line-height: 1.55; }
.settings-card, .model-card, .developer-note { border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-card); box-shadow: var(--shadow-sm); }
.settings-card { padding: 4px 14px 14px; }
.setting-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--border-color-light); }
.setting-row div { display: grid; gap: 4px; }
.setting-field { display: grid; gap: 8px; padding-top: 14px; }
.setting-slider-label { display: flex; justify-content: space-between; color: var(--text-primary); }
.setting-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.model-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 22px 0 10px; }
.model-heading h4 { margin: 0 0 4px; color: var(--text-primary); font-size: 14px; }
.model-list { display: grid; gap: 9px; }
.model-card { display: grid; gap: 7px; padding: 12px; }
.model-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--text-primary); }
.model-card > span, .model-card p { margin: 0; color: var(--text-tertiary); font-size: 12px; line-height: 1.5; }
.model-card .model-error { color: var(--color-danger); }
.model-actions { justify-self: start; }
.developer-note { display: grid; gap: 8px; margin-top: 16px; padding: 13px; }
.developer-note strong { color: var(--text-primary); font-size: 13px; }
.developer-note code { overflow-wrap: anywhere; padding: 8px; border-radius: 8px; background: var(--bg-hover); color: var(--color-primary); font-size: 11px; }
</style>
