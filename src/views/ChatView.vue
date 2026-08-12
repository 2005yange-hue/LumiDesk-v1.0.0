<template>
  <div class="chat-layout">
    <!-- 会话侧边栏 -->
    <ConversationSidebar
      @conversation-created="onConversationCreated"
      @conversation-selected="onConversationSelected"
      @conversation-deleted="onConversationDeleted"
    />

    <div class="chat-view">
      <!-- 顶部栏 -->
      <div class="chat-header">
      <h2>AI 桌面伙伴</h2>
      <div class="model-selector">
        <el-select
          v-model="selectedProviderId"
          placeholder="选择模型"
          size="small"
          style="width: 220px"
          @change="onProviderChange"
          :disabled="providerStore.providers.length === 0"
        >
          <el-option
            v-for="p in providerStore.providers"
            :key="p.id"
            :label="`${p.name} (${p.model})`"
            :value="p.id"
          />
        </el-select>
      </div>
      <div class="header-actions">
        <el-button text :icon="Delete" @click="handleClear" :disabled="messages.length === 0">
          清空
        </el-button>
        <el-button text @click="$router.push('/settings')">设置</el-button>
      </div>
    </div>

    <!-- 消息列表 -->
    <div class="chat-body" ref="bodyRef">
      <div v-if="messages.length === 0" class="welcome-message">
        <div class="welcome-avatar">{{ activeCharacterName[0] || '艾' }}</div>
        <p class="welcome-title">你好，我是{{ activeCharacterName }}</p>
        <div class="welcome-meta">
          <span class="meta-item">角色：{{ activeCharacterName }}</span>
          <span class="meta-item">模型：{{ activeModelName }}</span>
          <span class="meta-item meta-memory">长期记忆：已开启</span>
        </div>
        <p class="welcome-hint">有什么想聊的吗？</p>
      </div>

      <div
        v-for="msg in messages"
        :key="msg.id"
        :class="['message-row', msg.role]"
      >
        <div class="message-bubble" :class="msg.role">
          <template v-if="msg.role === 'assistant' && msg.content === '' && isStreaming && msg === messages[messages.length - 1]">
            <span class="thinking-dots">思考中<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></span>
          </template>
          <template v-else>
            {{ msg.content }}
          </template>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="error" class="error-banner">
        <el-alert :title="error" type="error" show-icon :closable="false" />
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="chat-footer">
      <div class="input-row">
        <el-input
          v-model="inputText"
          placeholder="输入消息..."
          :disabled="isStreaming"
          @keydown.enter.exact="handleEnter"
          resize="none"
        >
          <template #append>
            <!-- 流式生成中 → 停止按钮 -->
            <el-button
              v-if="isStreaming"
              type="danger"
              @click="handleStop"
            >
              停止生成
            </el-button>
            <!-- 待机 → 发送按钮 -->
            <el-button
              v-else
              type="primary"
              :disabled="!inputText.trim()"
              @click="handleSend"
            >
              发送
            </el-button>
          </template>
        </el-input>
      </div>
      <p class="footer-hint">按 Enter 发送消息</p>
    </div>
  </div>
</div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted, computed } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import { useChatStore } from '@/stores/chat.store'
import { useProviderStore } from '@/stores/provider.store'
import { useConversationStore } from '@/stores/conversation.store'
import { useSettingsStore } from '@/stores/settings.store'
import { storeToRefs } from 'pinia'
import type { CharacterData } from '@/types/character.types'
import { getCharacters } from '@/services/character.api'
import ConversationSidebar from '@/components/chat/ConversationSidebar.vue'

const store = useChatStore()
const providerStore = useProviderStore()
const conversationStore = useConversationStore()
const settingsStore = useSettingsStore()
const { messages, isStreaming, error } = storeToRefs(store)

const inputText = ref('')
const bodyRef = ref<HTMLElement | null>(null)
const selectedProviderId = ref<number | null>(null)
const characters = ref<CharacterData[]>([])

// ──── 空状态展示信息 ────
const activeCharacterName = computed(() => {
  if (settingsStore.activeCharacterId) {
    const char = characters.value.find((c) => c.id === settingsStore.activeCharacterId)
    if (char) return char.name
  }
  return characters.value[0]?.name || '艾莉'
})

const activeModelName = computed(() => {
  const active = providerStore.activeProvider()
  return active?.model || settingsStore.modelSettings.model || '未配置'
})

onMounted(async () => {
  await providerStore.refreshActive()
  if (providerStore.activeProviderId) {
    selectedProviderId.value = providerStore.activeProviderId
  }
  // 加载角色列表（用于空状态展示当前角色名）
  try {
    characters.value = await getCharacters()
  } catch {
    characters.value = []
  }
  // 加载会话列表，并恢复当前会话
  await conversationStore.fetchList()
  if (conversationStore.currentConversationId) {
    await store.loadConversation(conversationStore.currentConversationId)
  }
})

function onProviderChange(id: number): void {
  providerStore.saveActiveId(id)
}

// ──── 自动滚动到底部 ────
watch(
  () => messages.value.length,
  async () => {
    await nextTick()
    scrollToBottom()
  }
)

watch(
  () => messages.value[messages.value.length - 1]?.content,
  async () => {
    await nextTick()
    scrollToBottom()
  }
)

function scrollToBottom(): void {
  if (bodyRef.value) {
    bodyRef.value.scrollTop = bodyRef.value.scrollHeight
  }
}

// ──── 发送消息 ────
async function handleSend(): Promise<void> {
  if (!inputText.value.trim() || isStreaming.value) return

  const text = inputText.value
  inputText.value = ''
  await store.sendMessage(text)
}

// ──── 停止生成 ────
function handleStop(): void {
  store.stopGeneration()
}

// ──── Enter 键处理 ────
function handleEnter(): void {
  if (isStreaming.value) {
    // 生成中，Enter 停止
    handleStop()
  } else {
    handleSend()
  }
}

// ──── 清空对话 ────
function handleClear(): void {
  store.clearMessages()
  conversationStore.clearSelection()
}

// ──── 侧边栏事件 ────
async function onConversationCreated(): Promise<void> {
  store.clearMessages()
}

async function onConversationSelected(id: string): Promise<void> {
  await store.loadConversation(id)
}

async function onConversationDeleted(): Promise<void> {
  // store.remove() 已通过 fetchList 完成当前会话自动选择：
  // - 仍有其他会话 → 自动选择最近会话，加载其历史
  // - 无会话 → currentConversationId 为 null，清空聊天区
  if (conversationStore.currentConversationId) {
    await store.loadConversation(conversationStore.currentConversationId)
  } else {
    store.clearMessages()
  }
}
</script>

<style scoped lang="scss">
// ── 整体布局 ──
.chat-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.chat-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: rgba(245, 247, 250, 0.97);
}

// ── 顶部栏 ──
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  -webkit-app-region: drag; // Electron 拖拽区域

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }

  .header-actions {
    display: flex;
    gap: 4px;
    -webkit-app-region: no-drag;
  }

  .model-selector {
    -webkit-app-region: no-drag;
  }
}

// ── 消息区域 ──
.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: #c0c4cc;
    border-radius: 2px;
  }
}

// ── 欢迎页 ──
.welcome-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;

  .welcome-avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    margin-bottom: 16px;
  }

  p {
    margin: 4px 0;
    font-size: 16px;
  }

  .welcome-title {
    margin: 4px 0 12px;
    font-size: 16px;
    font-weight: 600;
    color: #606266;
  }

  .welcome-meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-bottom: 12px;

    .meta-item {
      font-size: 12px;
      color: #909399;
      background: #f4f4f5;
      padding: 4px 10px;
      border-radius: 12px;

      &.meta-memory {
        color: #67c23a;
        background: #f0f9eb;
      }
    }
  }

  .welcome-hint {
    font-size: 13px;
    color: #c0c4cc;
  }
}

// ── 消息行 ──
.message-row {
  display: flex;
  margin-bottom: 12px;

  &.user {
    justify-content: flex-end;
  }

  &.assistant {
    justify-content: flex-start;
  }
}

// ── 消息气泡 ──
.message-bubble {
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;

  &.user {
    background: #409eff;
    color: #fff;
    border-bottom-right-radius: 4px;
  }

  &.assistant {
    background: #fff;
    color: #303133;
    border: 1px solid #ebeef5;
    border-bottom-left-radius: 4px;
  }
}

// ── 思考动画 ──
.thinking-dots {
  color: #909399;
  .dot {
    animation: blink 1.4s infinite;
    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

@keyframes blink {
  0%, 20% { opacity: 0; }
  50% { opacity: 1; }
  100% { opacity: 0; }
}

// ── 错误提示 ──
.error-banner {
  margin-top: 8px;
}

// ── 输入区域 ──
.chat-footer {
  padding: 12px 16px;
  background: #fff;
  border-top: 1px solid #ebeef5;

  .input-row {
    width: 100%;

    :deep(.el-input-group__append) {
      padding: 0;
      .el-button {
        border: none;
        border-radius: 0 4px 4px 0;
      }
    }
  }

  .footer-hint {
    margin: 6px 0 0;
    font-size: 11px;
    color: #c0c4cc;
    text-align: center;
  }
}
</style>
