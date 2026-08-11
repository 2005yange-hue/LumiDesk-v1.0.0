<template>
  <div class="chat-view">
    <!-- 顶部栏 -->
    <div class="chat-header">
      <h2>AI 桌面伙伴</h2>
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
        <div class="welcome-avatar">艾莉</div>
        <p>你好，我是艾莉，你的桌面 AI 伙伴</p>
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
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import { useChatStore } from '@/stores/chat.store'
import { storeToRefs } from 'pinia'

const store = useChatStore()
const { messages, isStreaming, error } = storeToRefs(store)

const inputText = ref('')
const bodyRef = ref<HTMLElement | null>(null)

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
}
</script>

<style scoped lang="scss">
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
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
