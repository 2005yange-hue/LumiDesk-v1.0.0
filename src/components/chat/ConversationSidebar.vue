<template>
  <aside class="conversation-sidebar">
    <!-- 侧边栏头部 -->
    <div class="sidebar-header">
      <h3 class="sidebar-title">对话列表</h3>
      <el-button
        :icon="Plus"
        size="small"
        type="primary"
        circle
        @click="handleCreate"
        :disabled="store.loading"
        title="新建会话"
      />
    </div>

    <!-- 会话列表 -->
    <div class="sidebar-list" v-loading="store.loading">
      <div
        v-for="conv in store.conversationList"
        :key="conv.id"
        :class="['conversation-item', { active: conv.id === store.currentConversationId }]"
        @click="handleSelect(conv.id)"
      >
        <!-- 内容区 -->
        <div class="conv-content">
          <!-- 标题（可编辑） -->
          <div class="conv-header">
            <span
              v-if="editingId !== conv.id"
              class="conv-title"
              :title="conv.title || '新对话'"
            >
              {{ conv.title || '新对话' }}
            </span>
            <el-input
              v-else
              v-model="editTitle"
              size="small"
              class="conv-title-input"
              maxlength="200"
              @blur="handleTitleBlur(conv.id)"
              @keydown.enter="handleTitleBlur(conv.id)"
              @keydown.escape="cancelEdit"
              ref="titleInputRef"
            />
            <!-- 加载中显示 spinner，否则显示消息数 -->
            <el-icon v-if="isLoadingItem(conv.id)" class="conv-loading is-loading">
              <Loading />
            </el-icon>
            <span v-else class="conv-count">{{ conv.message_count }}</span>
          </div>
          <p class="conv-time">{{ formatTime(conv.updated_at) }}</p>
        </div>

        <!-- 悬浮操作按钮 -->
        <div class="conv-actions">
          <el-button
            :icon="EditPen"
            size="small"
            text
            @click.stop="startEdit(conv.id, conv.title || '')"
            title="重命名"
          />
          <el-popconfirm
            title="确定删除此对话及其所有消息？"
            confirm-button-text="删除"
            cancel-button-text="取消"
            @confirm="handleDelete(conv.id)"
          >
            <template #reference>
              <el-button
                :icon="DeleteIcon"
                size="small"
                text
                type="danger"
                @click.stop
                title="删除"
              />
            </template>
          </el-popconfirm>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="!store.loading && store.conversationList.length === 0" class="empty-hint">
        <p>暂无对话</p>
        <p class="sub">点击 + 开始新对话</p>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { Plus, EditPen, Delete as DeleteIcon, Loading } from '@element-plus/icons-vue'
import { useConversationStore } from '@/stores/conversation.store'

const store = useConversationStore()

// ──── 内联编辑 ────
const editingId = ref<string | null>(null)
const editTitle = ref('')
const titleInputRef = ref<InstanceType<typeof import('element-plus').ElInput> | null>(null)

/** 判断指定会话是否处于历史消息加载中 */
function isLoadingItem(id: string): boolean {
  return store.messagesLoading && store.currentConversationId === id
}

function startEdit(id: string, currentTitle: string): void {
  editingId.value = id
  editTitle.value = currentTitle
  nextTick(() => {
    // 自动聚焦输入框
    const inputEl = document.querySelector('.conv-title-input input') as HTMLInputElement
    if (inputEl) {
      inputEl.focus()
      inputEl.select()
    }
  })
}

async function handleTitleBlur(id: string): Promise<void> {
  if (editTitle.value.trim() && editTitle.value.trim().length <= 200) {
    await store.updateTitle(id, editTitle.value.trim())
  }
  cancelEdit()
}

function cancelEdit(): void {
  editingId.value = null
  editTitle.value = ''
}

// ──── 操作 ────
async function handleCreate(): Promise<void> {
  await store.create()
  emit('conversation-created')
}

function handleSelect(id: string): void {
  if (editingId.value) return
  store.selectConversation(id)
  emit('conversation-selected', id)
}

async function handleDelete(id: string): Promise<void> {
  await store.remove(id)
  emit('conversation-deleted', id)
}

// ──── 时间格式化 ────
function formatTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const diffDays = Math.round((startOfToday - startOfTarget) / 86400000)

  if (diffDays === 0) {
    // 今天 → HH:mm
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDays === 1) {
    // 昨天
    return '昨天'
  }
  // 更早 → YYYY-MM-DD
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ──── 事件 ────
const emit = defineEmits<{
  (e: 'conversation-created'): void
  (e: 'conversation-selected', id: string): void
  (e: 'conversation-deleted', id: string): void
}>()
</script>

<style scoped lang="scss">
.conversation-sidebar {
  display: flex;
  flex-direction: column;
  width: 260px;
  min-width: 260px;
  height: 100vh;
  background: #1a1d23;
  border-right: 1px solid #2d3039;
  overflow: hidden;
}

// ── 头部 ──
.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #2d3039;
  -webkit-app-region: drag;

  .sidebar-title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #e0e2e6;
  }

  .el-button {
    -webkit-app-region: no-drag;
  }
}

// ── 列表 ──
.sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: #3a3d45;
    border-radius: 2px;
  }
}

// ── 会话项 ──
.conversation-item {
  display: flex;
  align-items: flex-start;
  padding: 10px 12px;
  margin-bottom: 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;

  &:hover {
    background: #252830;

    .conv-actions {
      opacity: 1;
    }
  }

  &.active {
    background: #2d313a;
    border: 1px solid #4a4f5a;

    .conv-title {
      color: #409eff;
    }
  }
}

.conv-content {
  flex: 1;
  min-width: 0;
}

.conv-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.conv-title {
  font-size: 13px;
  color: #c9cdd4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.conv-title-input {
  flex: 1;
  min-width: 0;

  :deep(.el-input__inner) {
    background: #1a1d23;
    border-color: #409eff;
    color: #e0e2e6;
    font-size: 13px;
    height: 26px;
    padding: 0 8px;
  }
}

.conv-count {
  font-size: 11px;
  color: #6b7180;
  background: #252830;
  padding: 1px 6px;
  border-radius: 10px;
  flex-shrink: 0;
}

.conv-loading {
  font-size: 14px;
  color: #409eff;
  flex-shrink: 0;

  &.is-loading {
    animation: rotating 1s linear infinite;
  }
}

@keyframes rotating {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.conv-time {
  margin: 4px 0 0;
  font-size: 11px;
  color: #5c6270;
}

// ── 悬浮操作 ──
.conv-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
  margin-left: 4px;
  flex-shrink: 0;

  .el-button {
    color: #6b7180;

    &:hover {
      color: #e0e2e6;
      background: #3a3d45;
    }
  }
}

// ── 空状态 ──
.empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  color: #5c6270;

  p {
    margin: 0;
    font-size: 13px;
  }

  .sub {
    margin-top: 4px;
    font-size: 12px;
    color: #4a4f5a;
  }
}
</style>
