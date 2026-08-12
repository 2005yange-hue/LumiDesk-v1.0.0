<template>
  <div class="settings-page">
    <!-- 顶部栏 -->
    <div class="settings-header">
      <el-button text @click="$router.push('/')">
        <el-icon><ArrowLeft /></el-icon>
      </el-button>
      <h2 class="settings-title">设置</h2>
      <div class="spacer" />
    </div>

    <!-- Tab 内容区 -->
    <div class="settings-body">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="API 连接" name="provider">
          <ProviderSettings />
        </el-tab-pane>
        <el-tab-pane label="角色设置" name="character">
          <CharacterSettings />
        </el-tab-pane>
        <el-tab-pane label="关于" name="about">
          <AboutSection />
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowLeft } from '@element-plus/icons-vue'
import CharacterSettings from '@/components/settings/CharacterSettings.vue'
import AboutSection from '@/components/settings/AboutSection.vue'
import ProviderSettings from '@/components/settings/ProviderSettings.vue'

const activeTab = ref('provider')
</script>

<style scoped lang="scss">
.settings-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg-primary);
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
  -webkit-app-region: drag;
  background: var(--bg-secondary);

  h2 {
    flex: 1;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    text-align: center;
    color: var(--text-primary);
  }

  .spacer { width: 60px; }

  .el-button { -webkit-app-region: no-drag; }
}

.settings-body {
  flex: 1;
  overflow-y: auto;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: var(--text-placeholder); border-radius: 2px; }
}
</style>
