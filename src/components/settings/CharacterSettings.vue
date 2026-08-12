<template>
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

    <!-- 创建角色弹窗 -->
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSettingsStore } from '@/stores/settings.store'
import type { CharacterData } from '@/types/character.types'
import { getCharacters, createCharacter, deleteCharacter } from '@/services/character.api'

const settings = useSettingsStore()

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
.tab-content { padding: 0 16px 24px; }

.section { margin-bottom: 24px; }

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color-light);
}

.active-char-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--bg-hover);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);

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
    .char-name { font-size: 15px; font-weight: 600; color: var(--text-primary); }
    .char-tags { display: flex; gap: 4px; margin: 4px 0; }
    .char-desc { font-size: 12px; color: var(--text-tertiary); line-height: 1.5; }
  }
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color-light);

  .section-title { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
}

.char-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--border-color-medium);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 6px;

  &:hover { border-color: var(--color-primary); }
  &.active { border-color: var(--color-primary); background: var(--bg-hover); }

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

    .char-item-name { font-size: 13px; font-weight: 500; color: var(--text-primary); }
    .char-item-personality { font-size: 11px; color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  }

  .char-item-action {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }
}
</style>
