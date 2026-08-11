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
          <div class="tab-content">
            <div class="section">
              <h3 class="section-title">预设模型</h3>
              <div class="preset-grid">
                <div
                  v-for="preset in MODEL_PRESETS"
                  :key="preset.model"
                  :class="['preset-card', { active: settings.modelSettings.model === preset.model && settings.modelSettings.apiBaseUrl === preset.baseUrl }]"
                  @click="applyPreset(preset)"
                >
                  <div class="preset-name">{{ preset.label }}</div>
                  <div class="preset-provider">{{ preset.provider }}</div>
                </div>
              </div>
            </div>

            <div class="section">
              <h3 class="section-title">API 配置</h3>
              <el-form label-position="top" size="default">
                <el-form-item label="API Base URL">
                  <el-input
                    v-model="settings.modelSettings.apiBaseUrl"
                    placeholder="https://api.openai.com/v1"
                  />
                  <template #extra>
                    <span class="form-hint">支持 OpenAI 兼容接口</span>
                  </template>
                </el-form-item>

                <el-form-item label="API Key">
                  <el-input
                    v-model="settings.modelSettings.apiKey"
                    type="password"
                    show-password
                    placeholder="sk-..."
                  />
                  <template #extra>
                    <span class="form-hint">密钥仅存储在本地浏览器</span>
                  </template>
                </el-form-item>
              </el-form>
            </div>

            <div class="section">
              <h3 class="section-title">模型参数</h3>
              <el-form label-position="top" size="default">
                <el-form-item label="模型名称">
                  <el-input
                    v-model="settings.modelSettings.model"
                    placeholder="gpt-4o / deepseek-chat / qwen-plus"
                  />
                </el-form-item>

                <el-form-item :label="`Temperature (${settings.modelSettings.temperature})`">
                  <el-slider
                    v-model="settings.modelSettings.temperature"
                    :min="0" :max="2" :step="0.1" show-stops
                  />
                </el-form-item>

                <el-form-item label="最大 Token 数">
                  <el-input-number
                    v-model="settings.modelSettings.maxTokens"
                    :min="128" :max="8192" :step="128"
                    controls-position="right"
                  />
                </el-form-item>
              </el-form>
            </div>

            <div class="section actions">
              <el-button type="primary" @click="handleSave">保存配置</el-button>
              <el-button @click="handleReset">恢复默认</el-button>
            </div>
          </div>
        </el-tab-pane>

        <!-- ──── 角色设置 ──── -->
        <el-tab-pane label="角色设置" name="character">
          <div class="tab-content">
            <!-- 当前活跃角色 -->
            <div class="section" v-if="activeCharacter">
              <h3 class="section-title">当前角色</h3>
              <div class="active-char-card">
                <div class="char-avatar">{{ activeCharacter.name[0] }}</div>
                <div class="char-info">
                  <div class="char-name">{{ activeCharacter.name }}</div>
                  <div class="char-tags">
                    <el-tag size="small">{{ activeCharacter.gender === 'female' ? '女' : '男' }}</el-tag>
                    <el-tag size="small" v-if="activeCharacter.age">{{ activeCharacter.age }}岁</el-tag>
                    <el-tag size="small" type="success" effect="dark">使用中</el-tag>
                  </div>
                  <div class="char-desc">{{ activeCharacter.personality }}</div>
                </div>
              </div>
            </div>

            <!-- 角色列表 -->
            <div class="section">
              <div class="section-header">
                <h3 class="section-title">角色列表</h3>
                <el-button size="small" type="primary" text @click="showCreateDialog = true">+ 创建</el-button>
              </div>

              <div
                v-for="char in characters"
                :key="char.id"
                :class="['char-item', { active: activeCharacter?.id === char.id }]"
                @click="selectCharacter(char)"
              >
                <div class="char-item-avatar">{{ char.name[0] }}</div>
                <div class="char-item-info">
                  <div class="char-item-name">{{ char.name }}</div>
                  <div class="char-item-personality">{{ char.personality || '未设置性格' }}</div>
                </div>
                <div class="char-item-action">
                  <el-button
                    v-if="activeCharacter?.id !== char.id"
                    size="small"
                    type="primary"
                    text
                    @click.stop="selectCharacter(char)"
                  >使用</el-button>
                  <el-button
                    size="small"
                    text
                    type="danger"
                    @click.stop="handleDeleteCharacter(char)"
                    :disabled="characters.length <= 1"
                  >删除</el-button>
                </div>
              </div>

              <el-empty v-if="characters.length === 0" description="暂无角色" :image-size="60" />
            </div>
          </div>
        </el-tab-pane>

        <!-- ──── 创建角色弹窗 ──── -->
        <el-dialog v-model="showCreateDialog" title="创建角色" width="90%" :close-on-click-modal="false">
          <el-form label-position="top" size="default">
            <el-form-item label="角色名称" required>
              <el-input v-model="createForm.name" placeholder="例如：艾莉" maxlength="20" />
            </el-form-item>
            <el-form-item label="性别">
              <el-radio-group v-model="createForm.gender">
                <el-radio value="female">女</el-radio>
                <el-radio value="male">男</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="年龄">
              <el-input-number v-model="createForm.age" :min="1" :max="999" controls-position="right" />
            </el-form-item>
            <el-form-item label="性格描述">
              <el-input v-model="createForm.personality" placeholder="例如：温柔、理性、善解人意" maxlength="100" />
            </el-form-item>
            <el-form-item label="语言风格">
              <el-input v-model="createForm.speakingStyle" placeholder="例如：简洁、自然" maxlength="50" />
            </el-form-item>
            <el-form-item label="背景故事">
              <el-input v-model="createForm.background" type="textarea" :rows="2" placeholder="角色的身份和背景" maxlength="200" />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="showCreateDialog = false">取消</el-button>
            <el-button type="primary" @click="handleCreateCharacter" :disabled="!createForm.name.trim()">创建</el-button>
          </template>
        </el-dialog>

        <el-tab-pane label="关于" name="about">
          <div class="tab-content">
            <div class="about-section">
              <p class="app-name">AI 桌面伙伴</p>
              <p class="app-version">版本 0.1.0</p>
              <p class="app-desc">基于多模态大语言模型与长期记忆机制的智能桌面虚拟伙伴系统</p>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSettingsStore } from '@/stores/settings.store'
import { MODEL_PRESETS } from '@/types/settings.types'
import type { ModelPreset } from '@/types/settings.types'
import type { CharacterData } from '@/types/character.types'
import { getCharacters, createCharacter, deleteCharacter } from '@/services/character.api'

const settings = useSettingsStore()
const activeTab = ref('model')

// ──── 模型配置 ────

function applyPreset(preset: ModelPreset): void {
  settings.applyPreset(preset)
}

function handleSave(): void {
  ElMessage.success('配置已保存')
}

function handleReset(): void {
  settings.resetSettings()
  ElMessage.info('已恢复默认配置')
}

// ──── 角色管理 ────

const characters = ref<CharacterData[]>([])
const showCreateDialog = ref(false)
const createForm = ref({
  name: '',
  gender: 'female' as string,
  age: 20,
  personality: '',
  speakingStyle: '',
  background: ''
})

const activeCharacter = computed(() => {
  if (settings.activeCharacterId) {
    return characters.value.find((c) => c.id === settings.activeCharacterId)
  }
  return characters.value[0] || null
})

onMounted(async () => {
  try {
    characters.value = await getCharacters()
    // 如果没有选中角色，自动选择第一个
    if (!settings.activeCharacterId && characters.value.length > 0) {
      settings.setActiveCharacterId(characters.value[0].id)
    }
  } catch {
    ElMessage.warning('无法加载角色列表')
  }
})

function selectCharacter(char: CharacterData): void {
  settings.setActiveCharacterId(char.id)
  ElMessage.success(`已切换到角色「${char.name}」`)
}

async function handleCreateCharacter(): Promise<void> {
  if (!createForm.value.name.trim()) return
  try {
    const char = await createCharacter(createForm.value)
    characters.value.push(char)
    showCreateDialog.value = false
    // 重置表单
    createForm.value = { name: '', gender: 'female', age: 20, personality: '', speakingStyle: '', background: '' }
    ElMessage.success(`角色「${char.name}」创建成功`)
  } catch {
    ElMessage.error('创建失败')
  }
}

async function handleDeleteCharacter(char: CharacterData): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定要删除角色「${char.name}」吗？`, '确认删除', {
      type: 'warning'
    })
    await deleteCharacter(char.id)
    characters.value = characters.value.filter((c) => c.id !== char.id)
    // 如果删除的是当前角色，切换为第一个
    if (settings.activeCharacterId === char.id && characters.value.length > 0) {
      settings.setActiveCharacterId(characters.value[0].id)
    }
    ElMessage.success('已删除')
  } catch {
    // 用户取消
  }
}
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

.tab-content { padding: 0 16px 24px; }

.section { margin-bottom: 24px; }

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.preset-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.preset-card {
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover { border-color: #409eff; }

  &.active { border-color: #409eff; background: #ecf5ff; }

  .preset-name { font-size: 13px; font-weight: 500; color: #303133; }
  .preset-provider { font-size: 11px; color: #909399; margin-top: 2px; text-transform: capitalize; }
}

.form-hint { font-size: 11px; color: #909399; }

.actions { display: flex; gap: 8px; padding-top: 8px; }

.about-section {
  text-align: center;
  padding: 40px 0;

  .app-name { font-size: 18px; font-weight: 600; color: #303133; margin-bottom: 4px; }
  .app-version { font-size: 13px; color: #909399; margin-bottom: 16px; }
  .app-desc { font-size: 13px; color: #606266; line-height: 1.6; }
}

// ── 角色管理 ──
.active-char-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: linear-gradient(135deg, #667eea0a, #764ba20a);
  border: 1px solid #667eea33;
  border-radius: 10px;

  .char-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: #fff;
    font-size: 20px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .char-info {
    .char-name { font-size: 15px; font-weight: 600; color: #303133; }
    .char-tags { display: flex; gap: 4px; margin: 4px 0; }
    .char-desc { font-size: 12px; color: #909399; line-height: 1.5; }
  }
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;

  .section-title { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
}

.char-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 6px;

  &:hover { border-color: #409eff; }
  &.active { border-color: #409eff; background: #ecf5ff; }

  .char-item-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .char-item-info {
    flex: 1;
    min-width: 0;

    .char-item-name { font-size: 13px; font-weight: 500; color: #303133; }
    .char-item-personality { font-size: 11px; color: #909399; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  }

  .char-item-action {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }
}
</style>
