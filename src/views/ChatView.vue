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
      <h2>LumiDesk</h2>
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
      <div v-if="characterState" class="state-indicator">
        {{ characterStateSummary }}
      </div>
      <div class="header-actions">
        <el-dropdown trigger="click" @command="handleExport">
          <el-button text :icon="Download" :disabled="messages.length === 0">导出</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="markdown">导出 Markdown</el-dropdown-item>
              <el-dropdown-item command="json">导出 JSON</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button text :icon="Delete" @click="handleClear" :disabled="messages.length === 0">
          清空
        </el-button>
        <el-popover placement="bottom-end" :width="320" trigger="click" @show="loadNotifications">
          <template #reference>
            <el-badge :value="unreadNotificationCount" :hidden="unreadNotificationCount === 0" class="notification-badge">
              <el-button text :icon="Bell">提醒</el-button>
            </el-badge>
          </template>
          <div class="notification-panel">
            <div class="notification-title">{{ activeCharacterName }}的关心</div>
            <el-empty v-if="notifications.length === 0 && !notificationStore.loading" description="暂时没有新的提醒" :image-size="64" />
            <div v-else class="notification-list">
              <article
                v-for="notification in notifications"
                :key="notification.id"
                :class="['notification-item', { unread: notification.status === 'unread' }]"
                @click="markNotificationRead(notification.id)"
              >
                <span class="notification-type">{{ getNotificationTypeLabel(notification.type) }}</span>
                <span class="notification-content">{{ notification.content }}</span>
                <div class="notification-actions" @click.stop>
                  <el-button text size="small" @click="showNotificationReason(notification.id)">为什么收到</el-button>
                  <template v-if="notification.type === 'event_reminder' && notification.status !== 'dismissed'">
                    <el-button text size="small" @click="handleSnooze(notification.id, 'one_hour')">1 小时后</el-button>
                    <el-button text size="small" @click="handleSnooze(notification.id, 'tomorrow_morning')">明天 09:00</el-button>
                    <el-button text size="small" type="danger" @click="handleDismissNotification(notification.id)">不再提醒</el-button>
                  </template>
                  <el-button v-else-if="notification.status !== 'dismissed'" text size="small" @click="handleDismissNotification(notification.id)">忽略</el-button>
                </div>
              </article>
            </div>
          </div>
        </el-popover>
        <el-button text @click="$router.push('/memory')">记忆</el-button>
        <el-button text @click="$router.push('/emotion')">情绪</el-button>
        <el-button text @click="$router.push('/settings')">设置</el-button>
      </div>
    </div>

    <!-- 消息列表 -->
    <div class="chat-body" ref="bodyRef">
      <div v-if="hasMoreHistory" class="load-older">
        <el-button text :loading="loadingOlder" @click="handleLoadOlder">加载更早消息</el-button>
      </div>
      <div v-if="messages.length === 0" class="welcome-message">
        <div class="welcome-avatar">
          <img
            v-if="activeCharacter?.avatarUrl && !avatarLoadFailed"
            :src="resolveAvatarUrl(activeCharacter.avatarUrl)"
            :alt="`${activeCharacter.name}的头像`"
            @error="avatarLoadFailed = true"
          />
          <span v-else>{{ activeCharacterName[0] || '艾' }}</span>
        </div>
        <p class="welcome-title">你好，我是{{ activeCharacterName }}</p>
        <div class="welcome-meta">
          <span class="meta-item">角色：{{ activeCharacterName }}</span>
          <span class="meta-item">模型：{{ activeModelName }}</span>
          <span v-if="characterState" class="meta-item">{{ characterStateSummary }}</span>
          <span class="meta-item meta-memory">长期记忆：已开启</span>
        </div>
        <p class="welcome-hint">{{ activeCharacter?.openingMessage || '有什么想聊的吗？' }}</p>
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
        <div v-if="!isStreaming" class="message-actions">
          <el-button v-if="msg.role === 'user'" text size="small" @click="handleEditMessage(msg.id, msg.content)">编辑</el-button>
          <el-button v-if="msg.role === 'assistant'" text size="small" :icon="RefreshRight" @click="handleRegenerate(msg.id)">重生</el-button>
          <el-button v-if="msg.role === 'assistant' && msg.content" text size="small" @click="handleSpeak(msg)">
             {{ audioStore.currentMessageId === msg.id && audioStore.isPlaying ? '停止朗读' : audioStore.lastCompletedMessageId === msg.id ? '重播' : '朗读' }}
           </el-button>
          <el-button text size="small" @click="handleCopy(msg.content)">复制</el-button>
          <el-button text size="small" type="danger" @click="handleDeleteMessage(msg.id)">删除</el-button>
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
        <el-button
          class="voice-input-button"
          :type="audioStore.sttStatus === 'recording' ? 'danger' : 'default'"
          :loading="audioStore.sttStatus === 'transcribing'"
          @pointerdown.prevent="startVoiceInput"
          @pointerup.prevent="stopVoiceInput"
          @pointercancel.prevent="cancelVoiceInput"
          @pointerleave="stopVoiceInput"
        >
          {{ audioStore.sttStatus === 'recording' ? `松开结束 ${(audioStore.recordingMs / 1000).toFixed(1)}s` : '按住说话' }}
        </el-button>
      </div>
      <p class="footer-hint">按 Enter 发送消息 · {{ audioStore.ttsStatus === 'error' ? audioStore.ttsError : audioStore.sttError }}</p>
    </div>
  </div>
</div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { Bell, Delete, Download, RefreshRight } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { exportConversation } from '@/services/conversation.api'
import { getNotificationContext } from '@/services/notification.api'
import { useChatStore } from '@/stores/chat.store'
import { useProviderStore } from '@/stores/provider.store'
import { useConversationStore } from '@/stores/conversation.store'
import { useSettingsStore } from '@/stores/settings.store'
import { storeToRefs } from 'pinia'
import { useCharacterStore } from '@/stores/character.store'
import { useCharacterStateStore } from '@/stores/character-state.store'
import { useNotificationStore } from '@/stores/notification.store'
import { useAudioStore } from '@/stores/audio.store'
import type { ChatMessage } from '@/types/chat.types'
import {
  CHARACTER_MOOD_LABELS,
  CHARACTER_RELATIONSHIP_LABELS
} from '@/types/character-state.types'
import { NOTIFICATION_TYPE_LABELS, type NotificationType } from '@/types/notification.types'
import ConversationSidebar from '@/components/chat/ConversationSidebar.vue'
import { resolveAvatarUrl } from '@/utils/avatar'

const store = useChatStore()
const providerStore = useProviderStore()
const conversationStore = useConversationStore()
const settingsStore = useSettingsStore()
const characterStore = useCharacterStore()
const characterStateStore = useCharacterStateStore()
const notificationStore = useNotificationStore()
const audioStore = useAudioStore()
const { messages, isStreaming, error, loadingOlder, hasMoreHistory } = storeToRefs(store)
const { characters } = storeToRefs(characterStore)
const { state: characterState } = storeToRefs(characterStateStore)
const { notifications, unreadCount: unreadNotificationCount } = storeToRefs(notificationStore)

const inputText = ref('')
const bodyRef = ref<HTMLElement | null>(null)
const selectedProviderId = ref<number | null>(null)
let removeVoiceControl: (() => void) | undefined

// ──── 空状态展示信息 ────
const activeCharacterName = computed(() => {
  if (settingsStore.activeCharacterId) {
    const char = characters.value.find((c) => c.id === settingsStore.activeCharacterId)
    if (char) return char.name
  }
  return characters.value[0]?.name || '艾莉'
})

const activeCharacter = computed(() => {
  if (settingsStore.activeCharacterId) {
    return characters.value.find((character) => character.id === settingsStore.activeCharacterId) || characters.value[0]
  }
  return characters.value[0]
})

const avatarLoadFailed = ref(false)

const activeModelName = computed(() => {
  const active = providerStore.activeProvider()
  return active?.model || settingsStore.modelSettings.model || '未配置'
})

const activeCharacterId = computed(() =>
  settingsStore.activeCharacterId || characters.value[0]?.id || ''
)

watch(
  () => activeCharacter.value?.avatarUrl,
  () => {
    avatarLoadFailed.value = false
  }
)

const characterStateSummary = computed(() => {
  if (!characterState.value) return ''
  return `${CHARACTER_MOOD_LABELS[characterState.value.mood]} · ${CHARACTER_RELATIONSHIP_LABELS[characterState.value.relationship_level]} · 精力 ${characterState.value.energy} · 亲密度 ${characterState.value.affinity} · 主动性 ${characterState.value.initiative_level}`
})

onMounted(() => {
  // Provider 与角色数据已由 InitializationView 引导页预加载完成，
  // 此处仅同步 ChatView 本地 UI 状态，不重复发起网络请求。
  if (providerStore.activeProviderId) {
    selectedProviderId.value = providerStore.activeProviderId
  }
  // 进入主界面时加载当前选中会话的历史消息。
  // bootstrapStore 只初始化了会话列表与当前会话选择，未加载消息，
  // 需在此补齐一次加载（requestId 守卫保护快速切换场景）。
  if (conversationStore.currentConversationId) {
    store.loadConversation(conversationStore.currentConversationId)
  }
  void audioStore.fetchProviders()
  void audioStore.fetchGptSovits()
  removeVoiceControl = window.electronAPI?.onVoiceControl((action) => { if (action === 'stop') void audioStore.stopTts() })
})

onBeforeUnmount(() => { removeVoiceControl?.(); void audioStore.stopTts(); audioStore.cancelRecording() })

watch(
  activeCharacterId,
  (characterId) => {
    if (characterId) {
      void characterStateStore.fetchState(characterId)
      void notificationStore.fetchNotifications(characterId)
    }
  },
  { immediate: true }
)

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

watch(() => store.chatCompleteVersion, () => {
    const last = messages.value[messages.value.length - 1]
    if (last?.role === 'assistant' && last.content.trim()) void audioStore.playTts(last.content, last.id)
})

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
  audioStore.primePlayback()
  await audioStore.stopTts()
  await store.sendMessage(text)
  if (activeCharacterId.value) {
    await characterStateStore.fetchState(activeCharacterId.value)
  }
}

async function handleSpeak(message: ChatMessage): Promise<void> {
  if (audioStore.currentMessageId === message.id && audioStore.isPlaying) await audioStore.stopTts()
  else await audioStore.playTts(message.content, message.id, true)
}

async function startVoiceInput(): Promise<void> { audioStore.primePlayback(); await audioStore.startRecording() }
async function stopVoiceInput(): Promise<void> { const text = await audioStore.stopRecording(); if (text) inputText.value = text }
function cancelVoiceInput(): void { audioStore.cancelRecording() }

// ──── 停止生成 ────
function handleStop(): void {
  store.stopGeneration()
  void audioStore.stopTts()
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

async function handleLoadOlder(): Promise<void> {
  const conversationId = conversationStore.currentConversationId
  const body = bodyRef.value
  if (!conversationId || !body) return
  const previousHeight = body.scrollHeight
  await store.loadOlder(conversationId)
  await nextTick()
  body.scrollTop += body.scrollHeight - previousHeight
}

async function handleEditMessage(messageId: string, currentContent: string): Promise<void> {
  const conversationId = conversationStore.currentConversationId
  if (!conversationId) return
  try {
    const result = await ElMessageBox.prompt('编辑后将删除该轮及之后的消息，并重新生成回复。', '编辑消息', {
      inputValue: currentContent,
      inputPattern: /\S+/,
      inputErrorMessage: '消息不能为空',
      confirmButtonText: '保存并重生',
      cancelButtonText: '取消'
    })
    await store.editAndResend(conversationId, messageId, result.value)
  } catch {
    return
  }
}

async function handleRegenerate(messageId: string): Promise<void> {
  const conversationId = conversationStore.currentConversationId
  if (!conversationId) return
  try {
    await ElMessageBox.confirm('将删除这一轮及之后的消息，并重新生成回复。', '重新生成', { type: 'warning' })
    await store.regenerate(conversationId, messageId)
  } catch {
    return
  }
}

async function handleDeleteMessage(messageId: string): Promise<void> {
  const conversationId = conversationStore.currentConversationId
  if (!conversationId) return
  try {
    await ElMessageBox.confirm('将删除当前轮次及之后的消息，此操作无法撤销。', '删除消息', { type: 'warning' })
    await store.deleteTail(conversationId, messageId)
  } catch {
    return
  }
}

async function handleCopy(content: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(content)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

async function handleExport(format: 'markdown' | 'json' = 'markdown'): Promise<void> {
  const conversationId = conversationStore.currentConversationId
  if (!conversationId) return
  try {
    const result = await exportConversation(conversationId, format)
    const url = URL.createObjectURL(new Blob([result.content], { type: result.mimeType }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = result.filename
    anchor.click()
    URL.revokeObjectURL(url)
  } catch {
    ElMessage.error('导出失败')
  }
}

async function loadNotifications(): Promise<void> {
  if (activeCharacterId.value) await notificationStore.fetchNotifications(activeCharacterId.value)
}

async function markNotificationRead(id: number): Promise<void> {
  const notification = notifications.value.find((item) => item.id === id)
  if (!notification || notification.status === 'read') return
  await notificationStore.markRead(id)
}

async function showNotificationReason(id: number): Promise<void> {
  try {
    const context = await getNotificationContext(id)
    await ElMessageBox.alert(context.reason, '为什么收到此提醒', { confirmButtonText: '知道了' })
  } catch {
    ElMessage.error('暂时无法加载提醒原因')
  }
}

async function handleSnooze(id: number, mode: 'one_hour' | 'tomorrow_morning'): Promise<void> {
  try {
    await notificationStore.snooze(id, mode)
    ElMessage.success(mode === 'one_hour' ? '已在 1 小时后再次提醒' : '已改为明天 09:00 提醒')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '稍后提醒设置失败')
  }
}

async function handleDismissNotification(id: number): Promise<void> {
  try {
    await notificationStore.dismiss(id)
    ElMessage.success('已忽略此提醒')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '忽略提醒失败')
  }
}

function getNotificationTypeLabel(type: string): string {
  return NOTIFICATION_TYPE_LABELS[type as NotificationType] || 'AI 提醒'
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

  .state-indicator {
    font-size: 12px;
    color: #606266;
    background: #f4f4f5;
    padding: 4px 10px;
    border-radius: 12px;
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
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
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
  align-items: flex-end;
  gap: 6px;
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

.message-actions { display: flex; gap: 2px; opacity: 0; transition: opacity .15s; }
.message-row:hover .message-actions { opacity: 1; }
.load-older { display: flex; justify-content: center; margin-bottom: 12px; }

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

.notification-badge { margin-right: 2px; }

.notification-panel {
  max-height: 360px;
  overflow-y: auto;
}

.notification-title {
  margin-bottom: 8px;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.notification-list { display: grid; gap: 8px; }

.notification-item {
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: inherit;
  cursor: pointer;
  text-align: left;

  &.unread { border-color: var(--color-primary); background: var(--bg-hover); }
}

.notification-type { color: var(--color-primary); font-size: 12px; }
.notification-content { color: var(--text-secondary); font-size: 13px; line-height: 1.55; }

.notification-actions { display: flex; flex-wrap: wrap; gap: 2px; margin-top: 6px; }

// ── 输入区域 ──
.chat-footer {
  padding: 12px 16px;
  background: #fff;
  border-top: 1px solid #ebeef5;

  .input-row {
    display: flex;
    align-items: stretch;
    gap: 8px;
    width: 100%;

    :deep(.el-input) { flex: 1; }

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

.voice-input-button { flex: 0 0 auto; min-width: 92px; }
</style>
