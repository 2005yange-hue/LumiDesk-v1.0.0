<template>
  <div class="settings-view">
    <div class="settings-header">
      <el-button text @click="$router.push('/')">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      <h2>设置</h2>
      <div class="spacer"></div>
    </div>

    <div class="settings-body">
      <el-tabs v-model="activeTab" class="settings-tabs">
        <el-tab-pane label="模型配置" name="model">
          <ModelSettings />
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
import ModelSettings from '@/components/settings/ModelSettings.vue'
import CharacterSettings from '@/components/settings/CharacterSettings.vue'
import AboutSection from '@/components/settings/AboutSection.vue'

const activeTab = ref('model')
</script>

<style scoped lang="scss">
.settings-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #fff;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid #ebeef5;
  -webkit-app-region: drag;

  h2 {
    flex: 1;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    text-align: center;
  }

  .spacer { width: 60px; }

  .el-button { -webkit-app-region: no-drag; }
}

.settings-body {
  flex: 1;
  overflow-y: auto;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #c0c4cc; border-radius: 2px; }
}

.settings-tabs {
  height: 100%;
  :deep(.el-tabs__header) { padding: 0 16px; margin: 0; }
}
</style>
