<template>
  <div class="audio-settings">
    <el-card shadow="never" class="local-card">
      <template #header><div class="local-header"><strong>本地 GPT-SoVITS</strong><el-tag :type="localTagType">{{ localStatusLabel }}</el-tag></div></template>
      <div class="local-meta">{{ audio.gptSovitsStatus?.model || 'Mujica_若葉睦 v2ProPlus' }} · {{ audio.gptSovitsStatus?.device || 'cuda:0' }}</div>
      <el-alert v-if="audio.gptSovitsStatus?.error" :title="audio.gptSovitsStatus.error" type="error" :closable="false" />
      <el-form label-width="92px" size="small">
        <el-form-item label="TTS 引擎"><el-radio-group v-model="form.ttsEngine" @change="saveSettings"><el-radio-button label="gpt-sovits">GPT-SoVITS</el-radio-button><el-radio-button label="provider">外部 Provider</el-radio-button></el-radio-group></el-form-item>
        <template v-if="form.ttsEngine === 'gpt-sovits'">
          <el-form-item label="参考音频"><el-select v-model="gptForm.referenceId" style="width: 100%" @change="saveSettings"><el-option v-for="item in audio.gptSovitsReferences" :key="item.id" :label="item.label" :value="item.id" /></el-select></el-form-item>
          <el-form-item label="参考文本"><el-input v-model="gptForm.promptText" @change="saveSettings" /></el-form-item>
          <el-form-item label="参考语言"><el-input v-model="gptForm.promptLang" @change="saveSettings" /></el-form-item>
          <el-form-item label="回复语言"><el-input v-model="gptForm.textLang" @change="saveSettings" /></el-form-item>
          <el-button size="small" type="primary" :loading="localTesting" @click="testLocal">测试本地语音</el-button>
        </template>
      </el-form>
    </el-card>
    <div class="audio-toolbar">
      <strong>语音 Provider</strong>
      <el-button size="small" type="primary" @click="startCreate">新建</el-button>
    </div>
    <el-alert v-if="!audio.providers.length" title="尚未配置语音 Provider，文字聊天仍可正常使用。" type="info" :closable="false" />
    <div v-for="provider in audio.providers" :key="provider.id" class="audio-provider" :class="{ active: provider.id === audio.settings.providerId }">
      <div><strong>{{ provider.name }}</strong><small>{{ provider.tts_model }} / {{ provider.stt_model }}</small></div>
      <div class="audio-provider-actions">
        <el-button size="small" @click="edit(provider)">编辑</el-button>
        <el-button size="small" :loading="testingId === provider.id" @click="test(provider.id)">测试</el-button>
        <el-button size="small" type="success" :disabled="provider.id === audio.settings.providerId || !provider.enabled" @click="useProvider(provider.id)">设为默认</el-button>
        <el-button size="small" @click="toggleProvider(provider)">{{ provider.enabled ? '停用' : '启用' }}</el-button>
        <el-button size="small" type="danger" text @click="remove(provider.id)">删除</el-button>
      </div>
    </div>
    <el-divider />
    <el-form label-width="100px" size="small">
      <el-form-item label="自动朗读"><el-switch v-model="form.autoPlay" @change="saveSettings" /></el-form-item>
      <el-form-item label="音量"><el-slider v-model="form.volume" :min="0" :max="1" :step="0.05" @change="saveSettings" /></el-form-item>
      <el-form-item label="默认音色"><el-input v-model="form.voice" placeholder="alloy" @change="saveSettings" /></el-form-item>
      <el-form-item label="语速"><el-input-number v-model="form.speed" :min="0.25" :max="4" :step="0.05" @change="saveSettings" /></el-form-item>
    </el-form>
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑语音 Provider' : '新建语音 Provider'" width="520px">
      <el-form label-width="110px" size="small">
        <el-form-item label="名称"><el-input v-model="draft.name" /></el-form-item>
        <el-form-item label="Base URL"><el-input v-model="draft.base_url" placeholder="https://api.example.com/v1" /></el-form-item>
        <el-form-item label="API Key"><el-input v-model="draft.api_key" type="password" show-password /></el-form-item>
        <el-form-item label="TTS 模型"><el-input v-model="draft.tts_model" /></el-form-item>
        <el-form-item label="STT 模型"><el-input v-model="draft.stt_model" /></el-form-item>
        <el-form-item label="默认音色"><el-input v-model="draft.default_voice" /></el-form-item>
        <el-form-item label="默认语速"><el-input-number v-model="draft.default_speed" :min="0.25" :max="4" :step="0.05" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="saveProvider">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAudioStore } from '@/stores/audio.store'
import type { AudioProviderData, AudioProviderInfo } from '@/types/audio.types'

const audio = useAudioStore()
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const testingId = ref<number | null>(null)
const saving = ref(false)
const form = reactive({ ttsEngine: audio.settings.ttsEngine, autoPlay: audio.settings.autoPlay, volume: audio.settings.volume, voice: audio.settings.voice, speed: audio.settings.speed })
const gptForm = reactive({ ...audio.settings.gptSovits })
const localTesting = ref(false)
const localStatusLabel = computed(() => ({ unavailable: '未配置', stopped: '未启动', starting: '启动中', idle: '就绪', inferencing: '推理中', error: '错误' }[audio.gptSovitsStatus?.state || 'unavailable']))
const localTagType = computed(() => audio.gptSovitsStatus?.state === 'idle' ? 'success' : audio.gptSovitsStatus?.state === 'error' ? 'danger' : 'info')
const draft = reactive<AudioProviderData>({ name: '', base_url: '', api_key: '', tts_model: '', stt_model: '', default_voice: 'alloy', default_speed: 1, enabled: true })

onMounted(() => { void audio.fetchProviders(); void audio.fetchGptSovits() })
function saveSettings(): void { audio.updateSettings({ ...form, gptSovits: { ...gptForm } }) }
async function testLocal(): Promise<void> { localTesting.value = true; try { const result = await audio.testLocalTts(); if (result.success) ElMessage.success(`本地语音成功，${result.bytes} bytes`) ; else ElMessage.error(result.message || '本地语音测试失败'); await audio.fetchGptSovits() } finally { localTesting.value = false } }
function startCreate(): void { editingId.value = null; Object.assign(draft, { name: '', base_url: '', api_key: '', tts_model: '', stt_model: '', default_voice: 'alloy', default_speed: 1, enabled: true }); dialogVisible.value = true }
function edit(provider: AudioProviderInfo): void { editingId.value = provider.id; Object.assign(draft, { ...provider, api_key: '' }); dialogVisible.value = true }
async function saveProvider(): Promise<void> { if (!draft.name || !draft.base_url || !draft.tts_model || !draft.stt_model || (!editingId.value && !draft.api_key)) { ElMessage.warning('请填写名称、地址、TTS/STT 模型和 API Key'); return }; saving.value = true; try { const result = editingId.value ? await audio.updateProvider(editingId.value, draft.api_key ? draft : { ...draft, api_key: undefined }) : await audio.createProvider(draft); if (!result) throw new Error('保存失败'); dialogVisible.value = false; ElMessage.success('语音 Provider 已保存') } finally { saving.value = false } }
async function remove(id: number): Promise<void> { try { await ElMessageBox.confirm('删除后将无法使用此语音配置，确认继续？', '删除语音 Provider', { type: 'warning' }); if (await audio.removeProvider(id)) ElMessage.success('已删除') } catch {} }
async function useProvider(id: number): Promise<void> { await audio.updateProvider(id, { enabled: true, is_default: true }); audio.updateSettings({ providerId: id }); await audio.fetchProviders() }
async function toggleProvider(provider: AudioProviderInfo): Promise<void> { await audio.updateProvider(provider.id, { enabled: !provider.enabled, ...(provider.enabled ? {} : { is_default: true }) }); if (provider.enabled && audio.settings.providerId === provider.id) audio.updateSettings({ providerId: null }); await audio.fetchProviders() }
async function test(id: number): Promise<void> {
  testingId.value = id
  try {
    const result = await audio.testProvider(id)
    if (!result) return
    if (result.connected && result.tts) ElMessage.success(result.message || '接口已连接，TTS 可用；STT 需上传录音验证')
    else if (result.connected) ElMessage.warning(result.message || '接口已连接，但 TTS 不可用')
    else ElMessage.error(result.message || 'Provider 测试失败')
  } finally { testingId.value = null }
}
</script>

<style scoped lang="scss">
.audio-settings { display: grid; gap: 14px; padding: 16px; }
.audio-toolbar, .audio-provider, .audio-provider-actions { display: flex; align-items: center; gap: 8px; }
.audio-toolbar { justify-content: space-between; }
.audio-provider { justify-content: space-between; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card); }
.audio-provider.active { border-color: var(--color-primary); }
.audio-provider small { display: block; margin-top: 4px; color: var(--text-secondary); }
.audio-provider-actions { flex-wrap: wrap; justify-content: flex-end; }
</style>
