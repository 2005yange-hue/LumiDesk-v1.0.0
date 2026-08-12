<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑 API 配置' : '新建 API 配置'"
    width="480px"
    :close-on-click-modal="false"
    @close="resetForm"
  >
    <el-form :model="form" label-position="top" size="default">
      <el-form-item label="配置名称">
        <el-input v-model="form.name" placeholder="例如：我的 DeepSeek" />
      </el-form-item>

      <el-form-item label="服务商">
        <el-select v-model="form.provider" @change="onProviderChange">
          <el-option
            v-for="p in PROVIDER_PRESETS"
            :key="p.provider"
            :label="p.label"
            :value="p.provider"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="基础 URL">
        <el-input v-model="form.base_url" placeholder="https://api.deepseek.com/v1" />
      </el-form-item>

      <el-form-item label="API Key">
        <el-input
          v-model="form.api_key"
          type="password"
          show-password
          placeholder="sk-..."
        />
      </el-form-item>

      <el-form-item label="模型">
        <div class="model-row">
          <el-input v-model="form.model" placeholder="deepseek-chat" />
          <el-button text type="primary" @click="handleFetchModels" :loading="fetchingModels">
            获取模型
          </el-button>
        </div>
        <div v-if="modelList.length > 0" class="model-list">
          <el-radio-group v-model="form.model" size="small">
            <el-radio
              v-for="m in modelList.slice(0, 10)"
              :key="m.id"
              :value="m.id"
              class="model-radio"
            >
              {{ m.id }}
            </el-radio>
          </el-radio-group>
        </div>
      </el-form-item>

      <el-form-item label="连接测试">
        <el-button
          type="default"
          :loading="testing"
          @click="handleTest"
          :disabled="!form.base_url || !form.api_key || !form.model"
        >
          测试连接
        </el-button>
        <span v-if="testResult" :class="['test-result', testResult.success ? 'success' : 'fail']">
          {{ testResult.success ? `✓ 连接成功 (${testResult.latency}ms)` : `✗ ${testResult.message}` }}
        </span>
      </el-form-item>

      <el-form-item label="设为默认">
        <el-checkbox v-model="form.is_default">将此 Provider 设为默认连接</el-checkbox>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="handleSave" :loading="saving">
        {{ isEdit ? '保存' : '创建' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { PROVIDER_PRESETS, PROVIDER_TYPE_LABELS } from '@/types/provider.types'
import { useProviderStore } from '@/stores/provider.store'
import type { ProviderInfo } from '@/types/provider.types'

const props = defineProps<{
  modelValue: boolean
  editProvider?: ProviderInfo | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'saved'): void
}>()

const store = useProviderStore()

const visible = ref(props.modelValue)
watch(() => props.modelValue, (val) => { visible.value = val })
watch(visible, (val) => { emit('update:modelValue', val) })

const isEdit = ref(false)
const saving = ref(false)
const testing = ref(false)
const fetchingModels = ref(false)
const testResult = ref<{ success: boolean; latency: number; model: string; message?: string } | null>(null)
const modelList = ref<Array<{ id: string; owned_by: string }>>([])

const form = reactive({
  name: '',
  provider: 'openai-compatible',
  provider_type: 'openai-compatible',
  base_url: '',
  api_key: '',
  model: '',
  is_default: false
})

// 编辑时填充表单
watch(() => props.editProvider, (provider) => {
  if (provider) {
    isEdit.value = true
    form.name = provider.name
    form.provider = provider.provider
    form.provider_type = provider.provider_type || provider.provider
    form.base_url = provider.base_url
    form.model = provider.model
    form.is_default = provider.is_default
    form.api_key = '' // 不预填 API Key（安全）
  } else {
    isEdit.value = false
    resetForm()
  }
}, { immediate: true })

function onProviderChange(provider: string): void {
  const preset = PROVIDER_PRESETS.find((p) => p.provider === provider)
  if (preset) {
    form.provider_type = preset.providerType
    form.base_url = preset.baseUrl
    if (preset.defaultModel) form.model = preset.defaultModel
  }
}

async function handleTest(): Promise<void> {
  testing.value = true
  testResult.value = null
  const result = await store.testConnection(form.base_url, form.api_key, form.model)
  testResult.value = result
  testing.value = false
}

async function handleFetchModels(): Promise<void> {
  fetchingModels.value = true
  modelList.value = []
  const models = await store.fetchModelList(form.base_url, form.api_key)
  modelList.value = models
  fetchingModels.value = false
}

async function handleSave(): Promise<void> {
  saving.value = true
  try {
    if (isEdit.value && props.editProvider) {
      const updateData: Record<string, string | boolean> = {
        name: form.name,
        provider: form.provider,
        provider_type: form.provider_type,
        base_url: form.base_url,
        model: form.model,
        is_default: form.is_default
      }
      // 只有输入了新 Key 才更新
      if (form.api_key) {
        updateData.api_key = form.api_key
      }
      await store.updateProvider(props.editProvider.id, updateData)
    } else {
      await store.createProvider({
        name: form.name,
        provider: form.provider,
        provider_type: form.provider_type,
        base_url: form.base_url,
        api_key: form.api_key,
        model: form.model,
        is_default: form.is_default
      })
    }
    visible.value = false
    emit('saved')
  } finally {
    saving.value = false
  }
}

function resetForm(): void {
  form.name = ''
  form.provider = 'openai-compatible'
  form.provider_type = 'openai-compatible'
  form.base_url = ''
  form.api_key = ''
  form.model = ''
  form.is_default = false
  testResult.value = null
  modelList.value = []
}
</script>

<style scoped lang="scss">
.model-row {
  display: flex;
  gap: 8px;
  width: 100%;

  .el-input { flex: 1; }
  .el-button { flex-shrink: 0; }
}

.model-list {
  margin-top: 8px;
  max-height: 200px;
  overflow-y: auto;

  .model-radio {
    display: block;
    margin-bottom: 4px;
  }
}

.test-result {
  margin-left: 12px;
  font-size: 13px;

  &.success { color: var(--color-success); }
  &.fail { color: var(--color-danger); }
}
</style>
