<template>
  <div class="tab-content">
    <div class="about-section">
      <p class="app-name">AI 桌面伙伴</p>
      <p class="app-version">版本 0.1.0</p>
      <p class="app-desc">基于多模态大语言模型与长期记忆机制的智能桌面虚拟伙伴系统</p>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped lang="scss">
.tab-content { padding: 0 16px 24px; }

.about-section {
  text-align: center;
  padding: 40px 0;

  .app-name { font-size: 18px; font-weight: 600; color: #303133; margin-bottom: 4px; }
  .app-version { font-size: 13px; color: #909399; margin-bottom: 16px; }
  .app-desc { font-size: 13px; color: #606266; line-height: 1.6; }
}
</style>
