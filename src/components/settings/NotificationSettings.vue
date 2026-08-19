<template>
  <div class="notification-settings">
    <section class="settings-card">
      <div class="card-heading">
        <div>
          <h3>全局主动提醒</h3>
          <p>作为所有角色的默认规则；角色可单独覆盖。</p>
        </div>
        <el-switch v-model="globalForm.enabled" :disabled="saving" />
      </div>
      <el-form label-position="top" :disabled="saving || !globalForm.enabled">
        <el-form-item label="Windows 系统通知">
          <el-switch v-model="globalForm.systemEnabled" active-text="开启" inactive-text="关闭" />
        </el-form-item>
        <el-form-item label="提醒类型">
          <el-checkbox v-model="globalForm.eventReminderEnabled">事件提醒</el-checkbox>
          <el-checkbox v-model="globalForm.wellbeingCheckinEnabled">关切提醒</el-checkbox>
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="静默开始"><el-time-picker v-model="globalForm.quietStart" value-format="HH:mm" format="HH:mm" /></el-form-item>
          <el-form-item label="静默结束"><el-time-picker v-model="globalForm.quietEnd" value-format="HH:mm" format="HH:mm" /></el-form-item>
          <el-form-item label="每日上限"><el-input-number v-model="globalForm.dailyLimit" :min="0" :max="20" /></el-form-item>
          <el-form-item label="冷却（分钟）"><el-input-number v-model="globalForm.cooldownMinutes" :min="15" :max="1440" :step="15" /></el-form-item>
        </div>
      </el-form>
      <el-button type="primary" :loading="saving" @click="saveGlobal">保存全局设置</el-button>
    </section>

    <section v-if="activeCharacter" class="settings-card">
      <div class="card-heading">
        <div>
          <h3>{{ activeCharacter.name }}的覆盖设置</h3>
          <p>{{ hasOverride ? '此角色使用下方独立规则。' : '当前继承全局主动提醒规则。' }}</p>
        </div>
        <el-switch v-model="hasOverride" :disabled="saving" @change="toggleOverride" />
      </div>
      <el-form label-position="top" :disabled="saving || !hasOverride">
        <el-form-item label="启用主动提醒"><el-switch v-model="characterForm.enabled" /></el-form-item>
        <el-form-item label="Windows 系统通知"><el-switch v-model="characterForm.systemEnabled" /></el-form-item>
        <el-form-item label="提醒类型">
          <el-checkbox v-model="characterForm.eventReminderEnabled">事件提醒</el-checkbox>
          <el-checkbox v-model="characterForm.wellbeingCheckinEnabled">关切提醒</el-checkbox>
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="静默开始"><el-time-picker v-model="characterForm.quietStart" value-format="HH:mm" format="HH:mm" /></el-form-item>
          <el-form-item label="静默结束"><el-time-picker v-model="characterForm.quietEnd" value-format="HH:mm" format="HH:mm" /></el-form-item>
          <el-form-item label="每日上限"><el-input-number v-model="characterForm.dailyLimit" :min="0" :max="20" /></el-form-item>
          <el-form-item label="冷却（分钟）"><el-input-number v-model="characterForm.cooldownMinutes" :min="15" :max="1440" :step="15" /></el-form-item>
        </div>
      </el-form>
      <el-button type="primary" :disabled="!hasOverride" :loading="saving" @click="saveCharacter">保存角色覆盖</el-button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useCharacterStore } from '@/stores/character.store'
import { useSettingsStore } from '@/stores/settings.store'
import {
  deleteCharacterNotificationPreference,
  getCharacterNotificationPreference,
  getGlobalNotificationPreference,
  updateCharacterNotificationPreference,
  updateGlobalNotificationPreference
} from '@/services/notification.api'
import type { NotificationPreferenceInput } from '@/types/notification.types'

const characterStore = useCharacterStore()
const settingsStore = useSettingsStore()
const saving = ref(false)
const hasOverride = ref(false)
const globalForm = ref<Required<NotificationPreferenceInput>>({ enabled: true, systemEnabled: true, eventReminderEnabled: true, wellbeingCheckinEnabled: true, quietStart: '23:00', quietEnd: '08:00', dailyLimit: 3, cooldownMinutes: 720 })
const characterForm = ref<Required<NotificationPreferenceInput>>({ ...globalForm.value })

const activeCharacter = computed(() => characterStore.characters.find((character) => character.id === settingsStore.activeCharacterId) || characterStore.characters[0])

onMounted(async () => {
  await characterStore.fetchCharacters()
  await loadGlobal()
})

watch(() => activeCharacter.value?.id, () => void loadCharacter())

function fromRecord(record: Record<string, unknown>): Required<NotificationPreferenceInput> {
  return {
    enabled: Boolean(record.enabled),
    systemEnabled: Boolean(record.system_enabled ?? record.systemEnabled),
    eventReminderEnabled: Boolean(record.event_reminder_enabled ?? record.eventReminderEnabled),
    wellbeingCheckinEnabled: Boolean(record.wellbeing_checkin_enabled ?? record.wellbeingCheckinEnabled),
    quietStart: String(record.quiet_start ?? record.quietStart ?? '23:00'),
    quietEnd: String(record.quiet_end ?? record.quietEnd ?? '08:00'),
    dailyLimit: Number(record.daily_limit ?? record.dailyLimit ?? 3),
    cooldownMinutes: Number(record.cooldown_minutes ?? record.cooldownMinutes ?? 720)
  }
}

async function loadGlobal(): Promise<void> {
  try { globalForm.value = fromRecord(await getGlobalNotificationPreference() as unknown as Record<string, unknown>) } catch { ElMessage.error('无法加载通知设置') }
  await loadCharacter()
}

async function loadCharacter(): Promise<void> {
  if (!activeCharacter.value) return
  try {
    const result = await getCharacterNotificationPreference(activeCharacter.value.id)
    hasOverride.value = Boolean(result.override)
    characterForm.value = fromRecord(result.resolved as unknown as Record<string, unknown>)
  } catch { ElMessage.error('无法加载角色提醒设置') }
}

async function saveGlobal(): Promise<void> {
  saving.value = true
  try { globalForm.value = fromRecord(await updateGlobalNotificationPreference(globalForm.value) as unknown as Record<string, unknown>); ElMessage.success('全局提醒设置已保存') } catch { ElMessage.error('保存失败') } finally { saving.value = false }
}

async function toggleOverride(enabled: boolean): Promise<void> {
  if (!activeCharacter.value) return
  saving.value = true
  try {
    if (!enabled) {
      characterForm.value = fromRecord(await deleteCharacterNotificationPreference(activeCharacter.value.id) as unknown as Record<string, unknown>)
      ElMessage.success('已恢复全局规则')
    } else {
      const result = await updateCharacterNotificationPreference(activeCharacter.value.id, characterForm.value)
      characterForm.value = fromRecord(result.resolved as unknown as Record<string, unknown>)
      ElMessage.success('已启用角色覆盖')
    }
  } catch {
    hasOverride.value = !enabled
    ElMessage.error('更新角色覆盖失败')
  } finally { saving.value = false }
}

async function saveCharacter(): Promise<void> {
  if (!activeCharacter.value || !hasOverride.value) return
  saving.value = true
  try {
    const result = await updateCharacterNotificationPreference(activeCharacter.value.id, characterForm.value)
    characterForm.value = fromRecord(result.resolved as unknown as Record<string, unknown>)
    ElMessage.success('角色提醒设置已保存')
  } catch { ElMessage.error('保存失败') } finally { saving.value = false }
}
</script>

<style scoped lang="scss">
.notification-settings { display: grid; gap: 16px; padding: 0 16px 24px; }
.settings-card { padding: 14px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-card); }
.card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
h3 { margin: 0 0 4px; font-size: 14px; color: var(--text-primary); }
p { margin: 0; font-size: 12px; line-height: 1.5; color: var(--text-tertiary); }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 10px; }
:deep(.el-time-editor), :deep(.el-input-number) { width: 100%; }
</style>
