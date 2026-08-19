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
        <el-tab-pane label="语音" name="audio">
          <AudioSettings />
        </el-tab-pane>
        <el-tab-pane label="角色设置" name="character">
          <CharacterSettings />
        </el-tab-pane>
        <el-tab-pane label="主动提醒" name="notifications">
          <NotificationSettings />
        </el-tab-pane>
        <el-tab-pane label="情绪与隐私" name="emotion">
          <EmotionSettings />
        </el-tab-pane>
        <el-tab-pane label="桌宠形象" name="pet">
          <PetSettings />
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
import NotificationSettings from '@/components/settings/NotificationSettings.vue'
import EmotionSettings from '@/components/settings/EmotionSettings.vue'
import PetSettings from '@/components/settings/PetSettings.vue'
import AudioSettings from '@/components/settings/AudioSettings.vue'

const activeTab = ref('provider')
</script>

<style scoped lang="scss">
.settings-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-primary);
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  padding: 10px 152px 10px 16px;
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
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.settings-body :deep(.el-tabs) {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}

.settings-body :deep(.el-tabs__content) {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.settings-body :deep(.el-tab-pane) { padding-bottom: 24px; }
.settings-body :deep(.el-tabs__content::-webkit-scrollbar) { width: 6px; }
.settings-body :deep(.el-tabs__content::-webkit-scrollbar-thumb) { border-radius: 999px; background: var(--text-placeholder); }
</style>
