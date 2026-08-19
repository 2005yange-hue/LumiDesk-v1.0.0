<template>
  <div v-if="isElectron" class="window-controls" aria-label="窗口控制">
    <button class="window-control" type="button" aria-label="最小化" title="最小化" @click="minimize">—</button>
    <button class="window-control" type="button" :aria-label="isMaximized ? '还原窗口' : '最大化'" :title="isMaximized ? '还原窗口' : '最大化'" @click="toggleMaximize">
      <span :class="['maximize-icon', { restored: isMaximized }]" />
    </button>
    <button class="window-control close-control" type="button" aria-label="关闭" title="关闭" @click="close">×</button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const electronApi = window.electronAPI
const isElectron = Boolean(electronApi)
const isMaximized = ref(false)
let removeWindowStateListener: (() => void) | undefined

onMounted(() => {
  if (!electronApi) return
  void electronApi.isWindowMaximized().then((value) => { isMaximized.value = value })
  removeWindowStateListener = electronApi.onWindowMaximizedChange((value) => { isMaximized.value = value })
})

onBeforeUnmount(() => {
  removeWindowStateListener?.()
})

function minimize(): void {
  void electronApi?.minimizeWindow()
}

function toggleMaximize(): void {
  if (!electronApi) return
  void electronApi.toggleMaximizeWindow().then((value) => { isMaximized.value = value })
}

function close(): void {
  void electronApi?.closeWindow()
}
</script>

<style scoped lang="scss">
.window-controls {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 2100;
  display: flex;
  height: 38px;
  overflow: hidden;
  border-bottom: 1px solid rgba(104, 111, 188, .14);
  border-left: 1px solid rgba(104, 111, 188, .12);
  border-bottom-left-radius: 12px;
  background: rgba(255, 255, 255, .82);
  box-shadow: 0 4px 16px rgba(56, 63, 130, .08);
  backdrop-filter: blur(16px);
  -webkit-app-region: no-drag;
}

.window-control {
  display: grid;
  width: 44px;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  transition: background .16s ease, color .16s ease;
}

.window-control:hover { background: rgba(103, 109, 216, .1); color: var(--text-primary); }
.close-control { font-size: 23px; font-weight: 300; }
.close-control:hover { background: #ef5f6c; color: #fff; }

.maximize-icon {
  display: block;
  width: 12px;
  height: 12px;
  border: 1.5px solid currentColor;
  border-radius: 2px;
}

.maximize-icon.restored { position: relative; transform: translate(-1px, 1px); }
.maximize-icon.restored::after {
  position: absolute;
  width: 9px;
  height: 9px;
  top: -4px;
  left: 3px;
  border: 1.5px solid currentColor;
  border-radius: 2px;
  background: rgba(255, 255, 255, .82);
  content: '';
}
</style>