<template>
  <div class="provider-settings">
    <!-- 左侧：Provider 列表 -->
    <div class="provider-list-panel">
      <div class="panel-header">
        <span class="panel-title">API 配置</span>
        <el-button type="primary" size="small" @click="openCreate">新建</el-button>
      </div>

      <div v-if="store.loading" class="loading-hint">加载中...</div>

      <div v-else-if="store.providers.length === 0" class="empty-hint">
        <p>暂无 API 配置</p>
        <p class="sub">点击「新建」添加 API 连接</p>
      </div>

      <div
        v-for="p in store.providers"
        :key="p.id"
        :class="['provider-item', { active: p.enabled }]"
        @click="selectProvider(p)"
      >
        <div class="provider-status">
          <span :class="['dot', p.enabled ? 'on' : 'off']" />
          <span class="provider-name">{{ p.name }}</span>
        </div>
        <div class="provider-meta">
          <span class="model-tag">{{ p.model }}</span>
          <span class="url-hint">{{ formatUrl(p.base_url) }}</span>
        </div>
      </div>
    </div>

    <!-- 右侧：配置详情 -->
    <div class="provider-detail-panel" v-if="selected">
      <div class="detail-header">
        <h3>{{ selected.name }}</h3>
        <div class="detail-actions">
          <el-button size="small" @click="openEdit">编辑</el-button>
          <el-button
            size="small"
            type="success"
            :disabled="selected.enabled"
            @click="handleSetActive"
          >
            {{ selected.enabled ? '当前默认' : '设为默认' }}
          </el-button>
          <el-popconfirm title="确定删除此配置？" @confirm="handleDelete">
            <template #reference>
              <el-button size="small" type="danger" text>删除</el-button>
            </template>
          </el-popconfirm>
        </div>
      </div>

      <div class="detail-body">
        <div class="detail-row">
          <span class="label">服务商</span>
          <span class="value">{{ selected.provider }}</span>
        </div>
        <div class="detail-row">
          <span class="label">API 地址</span>
          <span class="value mono">{{ selected.base_url }}</span>
        </div>
        <div class="detail-row">
          <span class="label">模型</span>
          <span class="value mono">{{ selected.model }}</span>
        </div>
        <div class="detail-row">
          <span class="label">API Key</span>
          <span class="value mono">{{ selected.api_key }}</span>
        </div>
        <div class="detail-row">
          <span class="label">状态</span>
          <span :class="['value', selected.enabled ? 'on' : 'off']">
            {{ selected.enabled ? '已启用' : '未启用' }}
          </span>
        </div>
      </div>
    </div>

    <div class="provider-detail-panel empty-detail" v-else>
      <p>选择一个配置查看详情</p>
    </div>

    <!-- 新建/编辑弹窗 -->
    <ProviderDialog
      v-model="dialogVisible"
      :editProvider="editTarget"
      @saved="onSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useProviderStore } from '@/stores/provider.store'
import ProviderDialog from './ProviderDialog.vue'
import { ElMessage } from 'element-plus'
import type { ProviderInfo } from '@/types/provider.types'

const store = useProviderStore()
const dialogVisible = ref(false)
const editTarget = ref<ProviderInfo | null>(null)
const selected = ref<ProviderInfo | null>(null)

onMounted(() => {
  store.fetchProviders().then(() => {
    if (store.providers.length > 0 && !selected.value) {
      selected.value = store.providers[0]
    }
  })
})

function selectProvider(p: ProviderInfo): void {
  selected.value = p
}

function openCreate(): void {
  editTarget.value = null
  dialogVisible.value = true
}

function openEdit(): void {
  editTarget.value = selected.value
  dialogVisible.value = true
}

function onSaved(): void {
  if (store.providers.length > 0) {
    selected.value = store.providers.find((p) => p.enabled) || store.providers[0]
  }
}

async function handleSetActive(): Promise<void> {
  if (!selected.value || selected.value.enabled) return
  await store.setActive(selected.value.id)
  ElMessage.success(`已将「${selected.value.name}」设为默认`)
}

async function handleDelete(): Promise<void> {
  if (!selected.value) return
  const ok = await store.removeProvider(selected.value.id)
  if (ok) {
    ElMessage.success('已删除')
    selected.value = store.providers.length > 0 ? store.providers[0] : null
  }
}

function formatUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/+$/, '')
}
</script>

<style scoped lang="scss">
.provider-settings {
  display: flex;
  height: 100%;
  gap: 0;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

// ── 左侧列表 ──
.provider-list-panel {
  width: 260px;
  min-width: 260px;
  background: #fafafa;
  border-right: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #ebeef5;

    .panel-title {
      font-size: 14px;
      font-weight: 600;
      color: #303133;
    }
  }

  .loading-hint, .empty-hint {
    padding: 24px 16px;
    text-align: center;
    color: #909399;
    font-size: 13px;

    .sub { font-size: 12px; margin-top: 4px; }
  }
}

.provider-item {
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid #ebeef5;
  transition: background 0.15s;

  &:hover { background: #ecf5ff; }
  &.active { background: #ecf5ff; }

  .provider-status {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;

      &.on { background: #67c23a; }
      &.off { background: #c0c4cc; }
    }

    .provider-name {
      font-size: 14px;
      font-weight: 500;
      color: #303133;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .provider-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-left: 16px;

    .model-tag {
      font-size: 12px;
      color: #409eff;
    }

    .url-hint {
      font-size: 11px;
      color: #c0c4cc;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

// ── 右侧详情 ──
.provider-detail-panel {
  flex: 1;
  display: flex;
  flex-direction: column;

  &.empty-detail {
    align-items: center;
    justify-content: center;
    color: #c0c4cc;
    font-size: 14px;
  }

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #ebeef5;

    h3 {
      font-size: 16px;
      font-weight: 600;
      color: #303133;
      margin: 0;
    }

    .detail-actions {
      display: flex;
      gap: 8px;
    }
  }

  .detail-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    flex: 1;
    overflow-y: auto;
  }

  .detail-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;

    .label {
      width: 72px;
      flex-shrink: 0;
      font-size: 13px;
      color: #909399;
    }

    .value {
      font-size: 13px;
      color: #303133;
      word-break: break-all;

      &.mono {
        font-family: 'Cascadia Code', 'Fira Code', monospace;
        font-size: 12px;
      }

      &.on { color: #67c23a; font-weight: 500; }
      &.off { color: #f56c6c; }
    }
  }
}
</style>
