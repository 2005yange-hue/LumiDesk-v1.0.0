<template>
  <div class="tab-content">
    <div class="section" v-if="activeCharacter">
      <h3 class="section-title">当前角色</h3>
      <div class="active-char-card">
        <div class="char-avatar">
          <img
            v-if="hasAvatar(activeCharacter)"
            :src="resolveAvatarUrl(activeCharacter.avatarUrl)"
            :alt="`${activeCharacter.name}的头像`"
            @error="markAvatarFailed(activeCharacter.id)"
          />
          <span v-else>{{ activeCharacter.name[0] }}</span>
        </div>
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

    <div class="section" v-if="activeCharacter">
      <h3 class="section-title">主动互动</h3>
      <div class="initiative-card">
        <div class="initiative-copy">
          <strong>主动性 {{ initiativeLevel }}</strong>
          <span>关系等级会继续降低陌生阶段的主动提醒频率，避免打扰。</span>
        </div>
        <el-slider
          v-model="initiativeLevel"
          :min="0"
          :max="100"
          :step="5"
          show-input
          :disabled="initiativeSaving"
          @change="saveInitiative"
        />
      </div>
    </div>

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
        <div class="char-item-avatar">
          <img
            v-if="hasAvatar(char)"
            :src="resolveAvatarUrl(char.avatarUrl)"
            :alt="`${char.name}的头像`"
            @error="markAvatarFailed(char.id)"
          />
          <span v-else>{{ char.name[0] }}</span>
        </div>
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
          <el-button size="small" text @click.stop="openEditDialog(char)">编辑</el-button>
          <el-button
            size="small"
            text
            type="danger"
            :disabled="characters.length <= 1"
            @click.stop="handleDeleteCharacter(char)"
          >删除</el-button>
        </div>
      </div>

      <el-empty v-if="characters.length === 0" description="暂无角色" :image-size="60" />
    </div>

    <el-dialog v-model="showCreateDialog" title="创建角色" width="90%" :close-on-click-modal="false" @closed="resetCreateForm">
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
        <el-button type="primary" :disabled="!createForm.name.trim()" @click="handleCreateCharacter">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showEditDialog"
      title="编辑角色"
      width="90%"
      :close-on-click-modal="!editSaving"
      :close-on-press-escape="!editSaving"
      :show-close="!editSaving"
      @closed="resetEditDialog"
    >
      <el-form label-position="top" size="default">
        <el-form-item label="角色头像">
          <div class="avatar-editor">
            <div class="avatar-preview">
              <img v-if="editAvatarPreview" :src="editAvatarPreview" alt="头像预览" />
              <span v-else>{{ editForm.name[0] || '角' }}</span>
            </div>
            <div class="avatar-editor-actions">
              <el-button plain :disabled="editSaving" @click="avatarInput?.click()">选择头像</el-button>
              <span>支持 PNG、JPEG、WebP，最大 2 MB</span>
            </div>
            <input ref="avatarInput" class="avatar-file-input" type="file" accept="image/png,image/jpeg,image/webp" @change="handleAvatarSelection" />
          </div>
        </el-form-item>
        <el-form-item label="角色名称" required>
          <el-input v-model="editForm.name" maxlength="20" />
        </el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="editForm.gender">
            <el-radio value="female">女</el-radio>
            <el-radio value="male">男</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="年龄">
          <el-input-number v-model="editForm.age" :min="1" :max="999" controls-position="right" />
        </el-form-item>
        <el-form-item label="性格描述">
          <el-input v-model="editForm.personality" maxlength="100" />
        </el-form-item>
        <el-form-item label="语言风格">
          <el-input v-model="editForm.speakingStyle" maxlength="50" />
        </el-form-item>
        <el-form-item label="背景故事">
          <el-input v-model="editForm.background" type="textarea" :rows="3" maxlength="200" />
        </el-form-item>
        <el-form-item label="预设开场白">
          <el-input v-model="editForm.openingMessage" type="textarea" :rows="2" maxlength="200" placeholder="空会话时展示，不会保存为聊天消息" />
        </el-form-item>
        <el-form-item label="角色形象">
          <div class="appearance-editor">
            <el-select v-model="editForm.appearance.modelId" clearable placeholder="继承桌宠全局默认模型" :disabled="!isElectron">
              <el-option v-for="model in readyModels" :key="model.id" :label="`${model.name} · ${model.version}`" :value="model.id" />
            </el-select>
            <el-select v-model="editForm.appearance.presentationStyleId" placeholder="默认表现风格">
              <el-option label="默认表现" value="default" />
              <el-option label="温柔关怀" value="gentle" />
              <el-option label="元气活力" value="energetic" />
              <el-option label="冷静克制" value="cold_lady" />
            </el-select>
            <span v-if="isElectron">未选择模型时继承桌宠全局默认模型；表现风格控制同一模型的情绪与动作倾向。</span>
            <span v-else>角色形象仅在 Electron 桌面端可配置。</span>
          </div>
        </el-form-item>
        <el-form-item label="喜好">
          <el-select v-model="editForm.likes" multiple filterable allow-create default-first-option placeholder="输入后按回车新增">
            <el-option v-for="item in editForm.likes" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="厌恶">
          <el-select v-model="editForm.dislikes" multiple filterable allow-create default-first-option placeholder="输入后按回车新增">
            <el-option v-for="item in editForm.dislikes" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="关系称呼规则">
          <div class="addressing-rules">
            <div v-for="rule in addressingRules" :key="rule.key" class="addressing-rule">
              <span>{{ rule.label }}</span>
              <el-input v-model="editForm.addressingRules[rule.key]" type="textarea" :rows="2" :maxlength="120" />
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="editSaving" @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" :loading="editSaving" :disabled="!editForm.name.trim()" @click="handleSaveCharacter">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSettingsStore } from '@/stores/settings.store'
import { useCharacterStore } from '@/stores/character.store'
import type { CharacterData, CreateCharacterRequest, UpdateCharacterRequest } from '@/types/character.types'
import {
  createCharacter,
  deleteCharacter,
  getCharacters,
  updateCharacter,
  uploadCharacterAvatar
} from '@/services/character.api'
import { getCharacterState, updateInitiativeLevel } from '@/services/character-state.api'
import { resolveAvatarUrl } from '@/utils/avatar'
import type { RegisteredModel } from '@/live2d/live2d.types'

type RelationshipLevel = 'stranger' | 'familiar' | 'friend' | 'intimate' | 'special'
type AddressingRulesForm = Record<RelationshipLevel, string>
type EditCharacterForm = Omit<Required<UpdateCharacterRequest>, 'appearance'> & {
  addressingRules: AddressingRulesForm
  appearance: { modelId: string, presentationStyleId: string }
}

const defaultAddressingRules = (): AddressingRulesForm => ({
  stranger: '使用礼貌中性的称呼；用户未明确姓名时不要杜撰名字或昵称。',
  familiar: '若用户已经提供姓名，可以自然使用名字；不要使用亲密昵称。',
  friend: '可在有明确依据时使用用户名字或已知昵称，语气自然不过度。',
  intimate: '可使用用户明确接受的自定义昵称；始终尊重边界。',
  special: '可稳定使用用户明确接受的特别称呼；不要假设关系。'
})

const createEmptyForm = (): CreateCharacterRequest => ({
  name: '',
  gender: 'female',
  age: 20,
  personality: '',
  speakingStyle: '',
  background: ''
})

const createEditForm = (character?: CharacterData): EditCharacterForm => ({
  name: character?.name || '',
  gender: character?.gender || 'female',
  age: character?.age || 20,
  personality: character?.personality || '',
  speakingStyle: character?.speakingStyle || '',
  background: character?.background || '',
  openingMessage: character?.openingMessage || '',
  likes: [...(character?.likes || [])],
  dislikes: [...(character?.dislikes || [])],
  addressingRules: {
    ...defaultAddressingRules(),
    ...(character?.addressingRules || {})
  },
  appearance: { modelId: character?.appearance?.modelId || '', presentationStyleId: character?.appearance?.presentationStyleId || 'default' }
})

const addressingRules: Array<{ key: RelationshipLevel; label: string }> = [
  { key: 'stranger', label: '陌生' },
  { key: 'familiar', label: '熟悉' },
  { key: 'friend', label: '朋友' },
  { key: 'intimate', label: '亲密' },
  { key: 'special', label: '特殊关系' }
]

const settings = useSettingsStore()
const characterStore = useCharacterStore()
const characters = ref<CharacterData[]>([])
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const editingCharacterId = ref<string | null>(null)
const createForm = ref<CreateCharacterRequest>(createEmptyForm())
const editForm = ref<EditCharacterForm>(createEditForm())
const editSaving = ref(false)
const avatarInput = ref<HTMLInputElement | null>(null)
const pendingAvatar = ref<File | null>(null)
const editAvatarPreview = ref('')
const failedAvatarIds = ref(new Set<string>())
const initiativeLevel = ref(50)
const initiativeSaving = ref(false)
const models = ref<RegisteredModel[]>([])
const isElectron = Boolean(window.electronAPI)
const readyModels = computed(() => models.value.filter((model) => model.status === 'READY'))

const activeCharacter = computed(() => {
  if (settings.activeCharacterId) {
    return characters.value.find((character) => character.id === settings.activeCharacterId)
  }
  return characters.value[0] || null
})

onMounted(async () => {
  try {
    characters.value = await getCharacters()
    if (!settings.activeCharacterId && characters.value.length > 0) {
      settings.setActiveCharacterId(characters.value[0].id)
    }
    await loadInitiative()
    await loadLive2DModels()
  } catch {
    ElMessage.warning('无法加载角色列表')
  }
})

watch(() => activeCharacter.value?.id, () => {
  void loadInitiative()
})

async function loadLive2DModels(): Promise<void> {
  if (!window.electronAPI) return
  try {
    models.value = await window.electronAPI.refreshPetModels() as RegisteredModel[]
  } catch {
    models.value = []
  }
}

function hasAvatar(character: CharacterData): boolean {
  return Boolean(character.avatarUrl && !failedAvatarIds.value.has(character.id))
}

function markAvatarFailed(characterId: string): void {
  failedAvatarIds.value = new Set([...failedAvatarIds.value, characterId])
}

function clearAvatarFailure(characterId: string): void {
  const next = new Set(failedAvatarIds.value)
  next.delete(characterId)
  failedAvatarIds.value = next
}

function selectCharacter(character: CharacterData): void {
  settings.setActiveCharacterId(character.id)
  ElMessage.success(`已切换到角色「${character.name}」`)
}

async function loadInitiative(): Promise<void> {
  if (!activeCharacter.value) return
  try {
    const state = await getCharacterState(activeCharacter.value.id)
    initiativeLevel.value = state.initiative_level
  } catch {
    initiativeLevel.value = 50
  }
}

async function saveInitiative(value: number): Promise<void> {
  if (!activeCharacter.value) return
  initiativeSaving.value = true
  try {
    const state = await updateInitiativeLevel(activeCharacter.value.id, value)
    initiativeLevel.value = state.initiative_level
    ElMessage.success('主动性已更新')
  } catch {
    ElMessage.error('主动性更新失败')
  } finally {
    initiativeSaving.value = false
  }
}

function resetCreateForm(): void {
  createForm.value = createEmptyForm()
}

async function handleCreateCharacter(): Promise<void> {
  if (!createForm.value.name.trim()) return
  try {
    const character = await createCharacter(createForm.value)
    characters.value.push(character)
    void characterStore.fetchCharacters(true)
    showCreateDialog.value = false
    ElMessage.success(`角色「${character.name}」创建成功`)
  } catch {
    ElMessage.error('创建失败')
  }
}

function openEditDialog(character: CharacterData): void {
  editingCharacterId.value = character.id
  editForm.value = createEditForm(character)
  pendingAvatar.value = null
  editAvatarPreview.value = hasAvatar(character) ? resolveAvatarUrl(character.avatarUrl) : ''
  showEditDialog.value = true
}

function clearBlobPreview(): void {
  if (editAvatarPreview.value.startsWith('blob:')) {
    URL.revokeObjectURL(editAvatarPreview.value)
  }
}

function resetEditDialog(): void {
  clearBlobPreview()
  showEditDialog.value = false
  editingCharacterId.value = null
  pendingAvatar.value = null
  editAvatarPreview.value = ''
  editForm.value = createEditForm()
  if (avatarInput.value) avatarInput.value.value = ''
}

function handleAvatarSelection(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    ElMessage.error('头像仅支持 PNG、JPEG 或 WebP 格式')
    input.value = ''
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.error('头像文件不能超过 2 MB')
    input.value = ''
    return
  }

  clearBlobPreview()
  pendingAvatar.value = file
  editAvatarPreview.value = URL.createObjectURL(file)
}

async function syncCharacter(updated: CharacterData): Promise<void> {
  const index = characters.value.findIndex((character) => character.id === updated.id)
  if (index >= 0) {
    characters.value.splice(index, 1, updated)
  }
  clearAvatarFailure(updated.id)
  void characterStore.fetchCharacters(true)
}

async function handleSaveCharacter(): Promise<void> {
  if (!editingCharacterId.value || !editForm.value.name.trim() || editSaving.value) return

  editSaving.value = true
  try {
    const updated = await updateCharacter(editingCharacterId.value, editForm.value)
    await syncCharacter(updated)

    if (pendingAvatar.value) {
      try {
        const withAvatar = await uploadCharacterAvatar(editingCharacterId.value, pendingAvatar.value)
        await syncCharacter(withAvatar)
      } catch {
        const current = characters.value.find((character) => character.id === editingCharacterId.value)
        pendingAvatar.value = null
        clearBlobPreview()
        editAvatarPreview.value = current?.avatarUrl ? resolveAvatarUrl(current.avatarUrl) : ''
        ElMessage.error('角色资料已保存，但头像上传失败，请重新选择后再试')
        return
      }
    }

    showEditDialog.value = false
    ElMessage.success('角色资料已更新')
  } catch {
    ElMessage.error('角色资料更新失败')
  } finally {
    editSaving.value = false
  }
}

async function handleDeleteCharacter(character: CharacterData): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定要删除角色「${character.name}」吗？`, '确认删除', { type: 'warning' })
    await deleteCharacter(character.id)
    characters.value = characters.value.filter((item) => item.id !== character.id)
    void characterStore.fetchCharacters(true)
    if (settings.activeCharacterId === character.id && characters.value.length > 0) {
      settings.setActiveCharacterId(characters.value[0].id)
    }
    ElMessage.success('已删除')
  } catch {
    return
  }
}
</script>

<style scoped lang="scss">
.tab-content { padding: 0 16px 24px; }
.section { margin-bottom: 24px; }
.section-title { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color-light); }

.active-char-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--bg-hover);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);

  .char-avatar { width: 48px; height: 48px; font-size: 20px; }
  .char-info {
    .char-name { font-size: 15px; font-weight: 600; color: var(--text-primary); }
    .char-tags { display: flex; gap: 4px; margin: 4px 0; }
    .char-desc { font-size: 12px; color: var(--text-tertiary); line-height: 1.5; }
  }
}

.char-avatar,
.char-item-avatar,
.avatar-preview {
  overflow: hidden;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  img { width: 100%; height: 100%; object-fit: cover; display: block; }
}

.initiative-card { padding: 14px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-card); }
.initiative-copy { display: grid; gap: 4px; margin-bottom: 8px; strong { color: var(--text-primary); } span { color: var(--text-tertiary); font-size: 12px; line-height: 1.5; } }
.section-header { display: flex; align-items: center; justify-content: space-between; .section-title { margin-bottom: 12px; flex: 1; } }

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
  .char-item-avatar { width: 36px; height: 36px; font-size: 15px; }
  .char-item-info { flex: 1; min-width: 0; .char-item-name { font-size: 13px; font-weight: 500; color: var(--text-primary); } .char-item-personality { font-size: 11px; color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } }
  .char-item-action { display: flex; gap: 2px; flex-shrink: 0; }
}

.avatar-editor { display: flex; align-items: center; gap: 12px; }
.avatar-preview { width: 64px; height: 64px; font-size: 24px; }
.avatar-editor-actions { display: grid; gap: 6px; color: var(--text-tertiary); font-size: 12px; }
.avatar-file-input { display: none; }
.addressing-rules { width: 100%; display: grid; gap: 10px; }
.addressing-rule { display: grid; grid-template-columns: 72px 1fr; align-items: center; gap: 8px; color: var(--text-secondary); font-size: 13px; }
.appearance-editor { display: grid; width: 100%; gap: 6px; }
.appearance-editor span { color: var(--text-tertiary); font-size: 12px; line-height: 1.5; }
</style>

