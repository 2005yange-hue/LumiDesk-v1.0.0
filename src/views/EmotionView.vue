<template>
  <div class="emotion-page">
    <header class="emotion-header">
      <el-button text :icon="ArrowLeft" @click="router.push('/')">返回聊天</el-button>
      <div class="header-title">
        <span class="eyebrow">情绪中心</span>
        <h1>{{ activeCharacterName }}的情绪记录</h1>
      </div>
      <div class="header-actions">
        <el-button text :icon="Refresh" :loading="emotionStore.loading" @click="reload">刷新</el-button>
        <el-button text type="danger" :disabled="!activeCharacterId || emotionStore.records.length === 0" @click="clearAll">清除历史</el-button>
      </div>
    </header>

    <main class="emotion-content">
      <el-alert
        v-if="!emotionStore.enabled"
        title="情绪理解已关闭"
        description="系统不会再分析新消息或将近期状态用于回复。你仍可查看或清除已有记录。"
        type="info"
        :closable="false"
        show-icon
      />
      <el-alert v-if="emotionStore.error" class="emotion-error" title="加载情绪记录失败" type="error" show-icon :closable="false" />

      <section class="overview-grid">
        <article class="overview-card primary-card">
          <span class="card-label">近 7 天主要状态</span>
          <template v-if="emotionStore.summary?.primaryEmotion">
            <strong class="primary-emotion">{{ EMOTION_ICONS[emotionStore.summary.primaryEmotion] }} {{ EMOTION_LABELS[emotionStore.summary.primaryEmotion] }}</strong>
            <span>平均强度 {{ emotionStore.summary.averageIntensity.toFixed(1) }} / 5 · {{ emotionStore.summary.recentCount }} 条记录</span>
          </template>
          <span v-else>还没有可展示的情绪记录</span>
        </article>
        <article class="overview-card privacy-card">
          <span class="card-label">隐私与留存</span>
          <strong>最近 30 天</strong>
          <span>仅限当前角色会话，可在设置中关闭或随时清除。</span>
          <el-button text size="small" @click="router.push('/settings')">前往设置</el-button>
        </article>
      </section>

      <section class="trend-card">
        <div class="section-heading">
          <div>
            <h2>情绪趋势</h2>
            <p>展示当前角色最近 {{ rangeDays }} 天会话中识别到的状态。</p>
          </div>
          <el-radio-group v-model="rangeDays" size="small" @change="reload">
            <el-radio-button :label="7">近 7 天</el-radio-button>
            <el-radio-button :label="30">近 30 天</el-radio-button>
          </el-radio-group>
        </div>
        <div v-if="emotionStore.summary" class="distribution-list">
          <div v-for="emotion in EMOTION_TYPES" :key="emotion" class="distribution-row">
            <span class="distribution-label">{{ EMOTION_ICONS[emotion] }} {{ EMOTION_LABELS[emotion] }}</span>
            <div class="distribution-track"><span :style="{ width: distributionWidth(emotion) }" /></div>
            <strong>{{ emotionStore.summary.distribution[emotion] }}</strong>
          </div>
        </div>
      </section>

      <section class="records-card">
        <div class="section-heading">
          <div>
            <h2>识别记录</h2>
            <p>你可以修正系统判断，修正后的记录不会再被自动覆盖。</p>
          </div>
          <span class="record-count">{{ emotionStore.total }} 条</span>
        </div>
        <el-skeleton v-if="emotionStore.loading" :rows="5" animated />
        <el-empty v-else-if="emotionStore.records.length === 0" description="这个时间范围内还没有情绪记录" :image-size="88" />
        <div v-else class="record-list">
          <article v-for="record in emotionStore.records" :key="record.id" class="emotion-record">
            <div class="record-icon">{{ EMOTION_ICONS[record.emotion] }}</div>
            <div class="record-body">
              <div class="record-topline">
                <strong>{{ EMOTION_LABELS[record.emotion] }}</strong>
                <el-tag size="small" :type="record.source === 'manual' ? 'success' : 'info'">{{ EMOTION_SOURCE_LABELS[record.source] }}</el-tag>
                <span>{{ formatDate(record.occurred_at) }}</span>
              </div>
              <p>{{ record.reason || '系统识别到这条消息中的情绪表达。' }}</p>
              <div class="record-metrics">
                <span>强度 {{ record.intensity }} / 5</span>
                <span>置信度 {{ Math.round(record.confidence * 100) }}%</span>
              </div>
            </div>
            <div class="record-actions">
              <el-button text size="small" @click="openEdit(record)">修正</el-button>
              <el-button text size="small" type="danger" @click="removeRecord(record)">删除</el-button>
            </div>
          </article>
        </div>
      </section>
    </main>

    <el-dialog v-model="editVisible" title="修正情绪记录" width="440px" :close-on-click-modal="!emotionStore.saving">
      <el-form label-position="top">
        <el-form-item label="情绪">
          <el-select v-model="editForm.emotion">
            <el-option v-for="emotion in EMOTION_TYPES" :key="emotion" :value="emotion" :label="`${EMOTION_ICONS[emotion]} ${EMOTION_LABELS[emotion]}`" />
          </el-select>
        </el-form-item>
        <el-form-item label="强度">
          <el-slider v-model="editForm.intensity" :min="1" :max="5" :step="1" show-stops show-input />
        </el-form-item>
        <el-form-item label="说明（可选）">
          <el-input v-model="editForm.reason" type="textarea" :rows="3" maxlength="240" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="emotionStore.saving" @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="emotionStore.saving" @click="saveEdit">保存修正</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Refresh } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useCharacterStore } from '@/stores/character.store'
import { useEmotionStore } from '@/stores/emotion.store'
import { useSettingsStore } from '@/stores/settings.store'
import {
  EMOTION_ICONS,
  EMOTION_LABELS,
  EMOTION_SOURCE_LABELS,
  EMOTION_TYPES,
  type EmotionRecord,
  type EmotionType
} from '@/types/emotion.types'

const router = useRouter()
const characterStore = useCharacterStore()
const emotionStore = useEmotionStore()
const settingsStore = useSettingsStore()
const { characters } = storeToRefs(characterStore)
const rangeDays = ref<7 | 30>(30)
const editVisible = ref(false)
const editingId = ref<number | null>(null)
const editForm = reactive<{ emotion: EmotionType; intensity: number; reason: string }>({ emotion: 'calm', intensity: 2, reason: '' })

const activeCharacterId = computed(() => settingsStore.activeCharacterId || characters.value[0]?.id || '')
const activeCharacterName = computed(() => characters.value.find((character) => character.id === activeCharacterId.value)?.name || '角色')

onMounted(async () => {
  try {
    await characterStore.fetchCharacters()
    await emotionStore.fetchPreference()
    await reload()
  } catch {
    ElMessage.error('无法加载情绪中心')
  }
})

watch(activeCharacterId, (characterId, previousCharacterId) => {
  if (characterId && characterId !== previousCharacterId) void reload()
})

async function reload(): Promise<void> {
  if (!activeCharacterId.value) return
  try {
    await emotionStore.fetchEmotionData(activeCharacterId.value, rangeDays.value)
  } catch {
    // Store 已保留可展示的错误状态。
  }
}

function distributionWidth(emotion: EmotionType): string {
  const distribution = emotionStore.summary?.distribution
  if (!distribution) return '0%'
  const maximum = Math.max(...Object.values(distribution), 1)
  return `${(distribution[emotion] / maximum) * 100}%`
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function openEdit(record: EmotionRecord): void {
  editingId.value = record.id
  editForm.emotion = record.emotion
  editForm.intensity = record.intensity
  editForm.reason = record.reason || ''
  editVisible.value = true
}

async function saveEdit(): Promise<void> {
  if (editingId.value === null) return
  try {
    await emotionStore.editRecord(editingId.value, { ...editForm, reason: editForm.reason.trim() || undefined })
    editVisible.value = false
    ElMessage.success('情绪记录已修正')
  } catch {
    ElMessage.error('保存修正失败')
  }
}

async function removeRecord(record: EmotionRecord): Promise<void> {
  try {
    await ElMessageBox.confirm('删除后无法恢复这条情绪记录。', '删除记录', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' })
    await emotionStore.removeRecord(record.id)
    ElMessage.success('情绪记录已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error('删除情绪记录失败')
  }
}

async function clearAll(): Promise<void> {
  if (!activeCharacterId.value) return
  try {
    await ElMessageBox.confirm(`将永久清除“${activeCharacterName.value}”的全部情绪记录，此操作无法撤销。`, '清除情绪历史', {
      confirmButtonText: '清除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await emotionStore.clearRecords(activeCharacterId.value)
    ElMessage.success('情绪历史已清除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error('清除情绪历史失败')
  }
}
</script>

<style scoped lang="scss">
.emotion-page { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; background: var(--bg-primary); }
.emotion-header { display: flex; align-items: center; gap: 16px; flex: none; padding: 14px 152px 14px 20px; border-bottom: 1px solid var(--border-color); background: var(--bg-secondary); -webkit-app-region: drag; }
.emotion-header :deep(.el-button) { -webkit-app-region: no-drag; }
.header-title { min-width: 0; flex: 1; }
.eyebrow { display: block; margin-bottom: 2px; color: var(--color-primary); font-size: 12px; font-weight: 700; letter-spacing: .08em; }
h1 { margin: 0; overflow: hidden; color: var(--text-primary); font-size: 18px; text-overflow: ellipsis; white-space: nowrap; }
.header-actions { display: flex; gap: 4px; }
.emotion-content { min-height: 0; flex: 1; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; padding: 22px clamp(18px, 4vw, 48px) 36px; }
.emotion-content::-webkit-scrollbar { width: 6px; }
.emotion-content::-webkit-scrollbar-thumb { border-radius: 999px; background: var(--text-placeholder); }
.emotion-error { margin-top: 12px; }
.overview-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin: 16px 0; }
.overview-card, .trend-card, .records-card { border: 1px solid var(--border-color); border-radius: var(--radius-lg); background: var(--bg-card); box-shadow: var(--shadow-sm); }
.overview-card { display: grid; gap: 7px; padding: 18px; }
.primary-card { background: linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 10%, var(--bg-card)), var(--bg-card)); }
.card-label { color: var(--text-tertiary); font-size: 12px; }
.overview-card strong { color: var(--text-primary); font-size: 18px; }
.overview-card > span:last-child { color: var(--text-secondary); font-size: 13px; line-height: 1.55; }
.primary-emotion { font-size: 22px !important; }
.privacy-card :deep(.el-button) { justify-self: start; padding-left: 0; }
.trend-card, .records-card { margin-top: 16px; padding: 18px; }
.section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
h2 { margin: 0 0 4px; color: var(--text-primary); font-size: 15px; }
.section-heading p { margin: 0; color: var(--text-tertiary); font-size: 12px; line-height: 1.5; }
.distribution-list { display: grid; gap: 12px; }
.distribution-row { display: grid; grid-template-columns: 84px minmax(0, 1fr) 28px; align-items: center; gap: 10px; color: var(--text-secondary); font-size: 13px; }
.distribution-track { height: 8px; overflow: hidden; border-radius: 999px; background: var(--bg-hover); }
.distribution-track span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--color-primary), var(--color-primary-light)); transition: width .25s ease; }
.distribution-row strong { color: var(--text-primary); text-align: right; }
.record-count { color: var(--text-tertiary); font-size: 12px; }
.record-list { display: grid; gap: 10px; }
.emotion-record { display: flex; align-items: flex-start; gap: 12px; padding: 14px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-secondary); }
.record-icon { display: grid; width: 36px; height: 36px; flex: none; place-items: center; border-radius: 12px; background: var(--bg-hover); font-size: 19px; }
.record-body { min-width: 0; flex: 1; }
.record-topline { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.record-topline strong { color: var(--text-primary); font-size: 14px; }
.record-topline span { color: var(--text-tertiary); font-size: 12px; }
.record-body p { margin: 7px 0 0; color: var(--text-secondary); font-size: 13px; line-height: 1.55; }
.record-metrics { display: flex; gap: 12px; margin-top: 8px; color: var(--text-tertiary); font-size: 12px; }
.record-actions { display: flex; flex: none; gap: 2px; }
@media (max-width: 720px) { .emotion-header { gap: 8px; padding: 10px 12px; } .header-actions :deep(.el-button) { padding: 6px; } .overview-grid { grid-template-columns: 1fr; } .emotion-content { padding: 16px; } .record-actions { flex-direction: column; } }
</style>