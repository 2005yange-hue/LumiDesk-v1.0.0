<template>
  <div class="init-page">
    <div class="init-card">
      <div class="init-header">
        <div class="logo">LD</div>
        <h1 class="title">LumiDesk</h1>
        <p class="subtitle">正在初始化应用…</p>
      </div>

      <!-- 总进度 -->
      <el-progress
        :percentage="bootstrap.progress"
        :status="progressStatus"
        :stroke-width="8"
        class="init-progress"
      />

      <!-- 任务列表 -->
      <ul class="task-list">
        <li
          v-for="task in bootstrap.tasks"
          :key="task.id"
          :class="['task-item', task.status]"
        >
          <el-icon v-if="task.status === 'running'" class="task-icon is-loading">
            <Loading />
          </el-icon>
          <el-icon v-else-if="task.status === 'success'" class="task-icon task-icon--success">
            <CircleCheck />
          </el-icon>
          <el-icon v-else-if="task.status === 'error'" class="task-icon task-icon--error">
            <CircleClose />
          </el-icon>
          <el-icon v-else class="task-icon task-icon--pending">
            <MoreFilled />
          </el-icon>
          <span class="task-label">{{ task.label }}</span>
          <span v-if="task.error" class="task-error">{{ task.error }}</span>
        </li>
      </ul>

      <!-- 失败提示 + 重试 -->
      <div v-if="bootstrap.status === 'error'" class="error-box">
        <el-alert
          :title="bootstrap.errorMessage"
          type="error"
          show-icon
          :closable="false"
        />
        <el-button type="primary" :icon="Refresh" class="retry-btn" @click="retry">
          重新初始化
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  CircleCheck,
  CircleClose,
  Loading,
  MoreFilled,
  Refresh
} from '@element-plus/icons-vue'
import { useBootstrapStore } from '@/stores/bootstrap.store'

const router = useRouter()
const bootstrap = useBootstrapStore()

const progressStatus = computed(() => {
  if (bootstrap.status === 'error') return 'exception'
  if (bootstrap.status === 'success') return 'success'
  return ''
})

async function retry(): Promise<void> {
  const ok = await bootstrap.run()
  if (ok) {
    router.replace('/')
  }
}

onMounted(async () => {
  // 已完成初始化（例如返回重入）直接进入主界面
  if (bootstrap.status === 'success') {
    router.replace('/')
    return
  }
  // 正在初始化则不再重复触发
  if (bootstrap.status === 'running') return
  await retry()
})
</script>

<style scoped lang="scss">
.init-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-app-region: drag; // Electron 拖拽区域
  padding: 24px;
}

.init-card {
  width: 100%;
  max-width: 420px;
  padding: 32px 28px;
  background: var(--bg-secondary, #ffffff);
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  -webkit-app-region: no-drag;

  .init-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 28px;

    .logo {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 14px;
    }

    .title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary, #303133);
    }

    .subtitle {
      margin: 6px 0 0;
      font-size: 13px;
      color: var(--text-secondary, #606266);
    }
  }

  .init-progress {
    margin-bottom: 24px;
  }

  .task-list {
    list-style: none;
    margin: 0 0 8px;
    padding: 0;

    .task-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 4px;
      border-bottom: 1px solid var(--border-color, #ebeef5);

      &:last-child {
        border-bottom: none;
      }

      .task-icon {
        font-size: 18px;
        flex-shrink: 0;
        color: var(--text-placeholder, #c0c4cc);

        &--success { color: #67c23a; }
        &--error { color: #f56c6c; }
        &--pending { color: #c0c4cc; }
      }

      .task-label {
        flex: 1;
        font-size: 14px;
        color: var(--text-primary, #303133);
      }

      .task-error {
        font-size: 12px;
        color: #f56c6c;
        max-width: 180px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      &.running .task-label { color: #409eff; }
      &.error .task-label { color: #f56c6c; }
    }
  }

  .error-box {
    margin-top: 16px;

    .retry-btn {
      width: 100%;
      margin-top: 12px;
    }
  }
}
</style>
