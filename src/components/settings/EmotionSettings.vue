<template>
  <div class="emotion-settings">
    <section class="settings-card">
      <div class="card-heading">
        <div>
          <h3>情绪理解与隐私</h3>
          <p>仅在当前角色的会话范围内识别用户情绪，记录默认保留 30 天。</p>
        </div>
        <el-switch :model-value="emotionStore.enabled" :loading="emotionStore.saving" @change="handleEnabledChange" />
      </div>
      <p class="privacy-note">关闭后不再分析新消息，也不会把近期情绪注入回复上下文；已有记录会保留，直到你手动清除。</p>
      <div class="actions">
        <el-button @click="router.push('/emotion')">打开情绪中心</el-button>
        <el-button type="danger" plain :disabled="!activeCharacter || emotionStore.saving" @click="clearHistory">清除当前角色历史</el-button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useCharacterStore } from '@/stores/character.store'
import { useEmotionStore } from '@/stores/emotion.store'
import { useSettingsStore } from '@/stores/settings.store'

const router = useRouter()
const characterStore = useCharacterStore()
const settingsStore = useSettingsStore()
const emotionStore = useEmotionStore()
const { characters } = storeToRefs(characterStore)

const activeCharacter = computed(() =>
  characters.value.find((character) => character.id === settingsStore.activeCharacterId) || characters.value[0]
)

onMounted(async () => {
  try {
    await Promise.all([characterStore.fetchCharacters(), emotionStore.fetchPreference()])
  } catch {
    ElMessage.error('无法加载情绪隐私设置')
  }
})

async function handleEnabledChange(value: string | number | boolean): Promise<void> {
  try {
    await emotionStore.setEnabled(Boolean(value))
    ElMessage.success(Boolean(value) ? '已开启情绪理解' : '已关闭情绪理解')
  } catch {
    ElMessage.error('保存情绪设置失败')
  }
}

async function clearHistory(): Promise<void> {
  if (!activeCharacter.value) return
  try {
    await ElMessageBox.confirm(`将永久清除“${activeCharacter.value.name}”会话中的全部情绪记录，此操作无法撤销。`, '清除情绪历史', {
      confirmButtonText: '清除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await emotionStore.clearRecords(activeCharacter.value.id)
    ElMessage.success('情绪历史已清除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error('清除情绪历史失败')
  }
}
</script>

<style scoped lang="scss">
.emotion-settings { padding: 0 16px 24px; }
.settings-card { padding: 14px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-card); }
.card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
h3 { margin: 0 0 4px; color: var(--text-primary); font-size: 14px; }
p { margin: 0; color: var(--text-tertiary); font-size: 12px; line-height: 1.55; }
.privacy-note { margin-top: 12px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
</style>