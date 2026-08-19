<template>
  <div class="memory-page">
    <header class="memory-header">
      <el-button text @click="$router.push('/')">
        <el-icon><ArrowLeft /></el-icon>
      </el-button>
      <h2>{{ activeCharacterName }}的记忆</h2>
      <el-button text :icon="Refresh" :loading="memoryStore.loading" @click="reloadMemories">
        刷新
      </el-button>
    </header>

    <main class="memory-body" v-loading="memoryStore.loading">
      <el-alert
        v-if="memoryStore.error"
        class="memory-error"
        :title="memoryStore.error"
        type="error"
        show-icon
        :closable="false"
      >
        <template #default>
          <el-button link type="danger" @click="reloadMemories">重试</el-button>
        </template>
      </el-alert>

<section v-if="relationshipStore.profile" class="relationship-section">
        <div class="section-title">
          <span>🤝 关系成长</span>
          <el-tag type="success" effect="plain">{{ relationshipLabel }}</el-tag>
        </div>
        <el-card class="relationship-card" shadow="never">
          <div class="relationship-stats">
            <div><strong>相识 {{ relationshipStore.profile.days_known }} 天</strong><span>从第一次互动开始计算</span></div>
            <div><strong>累计交流 {{ relationshipStore.profile.state.interaction_count }} 次</strong><span>共同经历 {{ relationshipStore.profile.state.shared_experience_count }} 件</span></div>
          </div>
          <el-divider content-position="left">关系成长记录</el-divider>
          <el-empty v-if="relationshipStore.profile.history.length === 0" description="下一次关系阶段变化会记录在这里" :image-size="48" />
          <el-timeline v-else class="relationship-timeline">
            <el-timeline-item
              v-for="entry in relationshipStore.profile.history"
              :key="entry.id"
              :timestamp="formatDate(entry.created_at)"
              type="primary"
            >
              <strong>{{ relationshipLevelLabel(entry.old_level) }} → {{ relationshipLevelLabel(entry.new_level) }}</strong>
              <p>{{ entry.reason }}</p>
            </el-timeline-item>
          </el-timeline>
          <el-divider content-position="left">关系里程碑</el-divider>
          <div v-if="relationshipStore.profile.milestones.length" class="milestone-list">
            <div v-for="milestone in relationshipStore.profile.milestones" :key="milestone.id" class="milestone-item">
              <strong>🏅 {{ milestone.title }}</strong>
              <span>{{ milestone.description }}</span>
            </div>
          </div>
          <el-empty v-else description="继续相处，解锁第一枚里程碑" :image-size="48" />
        </el-card>
      </section>

      <el-empty
        v-if="!memoryStore.loading && !memoryStore.error && !memoryStore.memories.length"
        description="这个角色还没有长期记忆"
      />

      <section
        v-for="group in activeMemoryGroups"
        :key="group.type"
        v-show="group.items.length > 0"
        class="memory-section"
      >
        <div class="section-title">
          <span>{{ group.icon }} {{ group.label }}</span>
          <el-tag size="small" effect="plain">{{ group.items.length }}</el-tag>
        </div>

        <div class="memory-list">
          <el-card v-for="memory in group.items" :key="memory.id" class="memory-card" shadow="hover">
            <p class="memory-content">{{ memory.content }}</p>

            <div class="memory-metrics">
              <span>重要度</span>
              <el-progress
                :percentage="toPercentage(memory.importance)"
                :show-text="false"
                :stroke-width="6"
              />
              <strong>{{ toPercentage(memory.importance) }}%</strong>
            </div>
            <div class="memory-meta">
              <span>置信度 {{ toPercentage(memory.confidence) }}%</span>
              <el-tag v-if="memory.vector_sync_status === 'failed'" type="danger" size="small">
                向量同步失败
              </el-tag>
              <el-tag v-else-if="memory.vector_sync_status === 'pending'" type="warning" size="small">
                向量同步中
              </el-tag>
            </div>
            <p v-if="memory.vector_sync_error" class="sync-error">{{ memory.vector_sync_error }}</p>

            <div class="memory-actions">
              <el-button link type="primary" @click="openEdit(memory)">编辑</el-button>
              <el-button
                link
                type="danger"
                :loading="memoryStore.deletingId === memory.id"
                @click="confirmDelete(memory)"
              >
                删除
              </el-button>
            </div>
          </el-card>
        </div>
      </section>

      <section v-if="historyMemories.length > 0" class="memory-history">
        <el-divider content-position="left">历史记忆</el-divider>
        <el-collapse>
          <el-collapse-item :title="`已替代或归档的记忆（${historyMemories.length}）`">
            <div class="memory-list">
              <el-card v-for="memory in historyMemories" :key="memory.id" class="memory-card history-card" shadow="never">
                <div class="history-heading">
                  <el-tag :type="memory.status === 'superseded' ? 'warning' : 'info'" size="small">
                    {{ MEMORY_STATUS_LABELS[memory.status] }}
                  </el-tag>
                  <span v-if="memory.replacement_memory_id">已由记忆 #{{ memory.replacement_memory_id }} 替代</span>
                </div>
                <p class="memory-content">{{ memory.content }}</p>
                <div class="memory-meta">
                  <span>质量分 {{ toPercentage(memory.memory_score) }}%</span>
                  <span>使用 {{ memory.usage_count }} 次</span>
                </div>
                <div class="memory-actions">
                  <el-button
                    link
                    type="danger"
                    :loading="memoryStore.deletingId === memory.id"
                    @click="confirmDelete(memory)"
                  >
                    删除
                  </el-button>
                </div>
              </el-card>
            </div>
          </el-collapse-item>
        </el-collapse>
      </section>
    </main>

    <el-dialog v-model="editDialogVisible" title="编辑记忆" width="460px" destroy-on-close>
      <el-form :model="editForm" label-width="72px">
        <el-form-item label="类型">
          <el-select v-model="editForm.type" style="width: 100%">
            <el-option
              v-for="(label, type) in MEMORY_TYPE_LABELS"
              :key="type"
              :label="label"
              :value="type"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="editForm.content" type="textarea" :rows="4" maxlength="2000" show-word-limit />
        </el-form-item>
        <el-form-item label="重要度">
          <el-slider v-model="editForm.importance" :min="0" :max="1" :step="0.05" show-input />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="memoryStore.saving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Refresh } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { useCharacterStore } from '@/stores/character.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useMemoryStore } from '@/stores/memory.store'
import { useRelationshipStore } from '@/stores/relationship.store'
import { CHARACTER_RELATIONSHIP_LABELS, type CharacterRelationshipLevel } from '@/types/character-state.types'
import {
  MEMORY_TYPE_ICONS,
  MEMORY_TYPE_LABELS,
  MEMORY_STATUS_LABELS,
  type MemoryEntry,
  type MemoryType,
  type StoredMemoryType
} from '@/types/memory.types'

const characterStore = useCharacterStore()
const settingsStore = useSettingsStore()
const memoryStore = useMemoryStore()
const relationshipStore = useRelationshipStore()
const { characters } = storeToRefs(characterStore)
const editDialogVisible = ref(false)
const initialized = ref(false)
const editingMemoryId = ref<number | null>(null)

const editForm = reactive<{ type: MemoryType; content: string; importance: number }>({
  type: 'fact',
  content: '',
  importance: 0.5
})

const activeCharacterId = computed(() =>
  settingsStore.activeCharacterId || characters.value[0]?.id || ''
)

const activeCharacterName = computed(() =>
  characters.value.find((character) => character.id === activeCharacterId.value)?.name || '角色'
)

const activeMemoryGroups = computed(() =>
  (Object.keys(MEMORY_TYPE_LABELS) as MemoryType[]).map((type) => ({
    type,
    label: MEMORY_TYPE_LABELS[type],
    icon: MEMORY_TYPE_ICONS[type],
    items: memoryStore.memories.filter(
      (memory) => memory.status === 'active' && normalizeType(memory.type) === type
    )
  }))
)

const historyMemories = computed(() =>
  memoryStore.memories.filter((memory) => memory.status !== 'active')
)

const relationshipLabel = computed(() => {
  const level = relationshipStore.profile?.state.relationship_level
  return level ? CHARACTER_RELATIONSHIP_LABELS[level] : '关系加载中'
})

onMounted(async () => {
  try {
    await characterStore.fetchCharacters()
    initialized.value = true
    await reloadMemories()
  } catch {
    initialized.value = true
  }
})

watch(activeCharacterId, (characterId) => {
  if (initialized.value && characterId) {
    void memoryStore.fetchMemories(characterId)
    void relationshipStore.fetchProfile(characterId)
  }
})

async function reloadMemories(): Promise<void> {
  if (!activeCharacterId.value) return
  try {
    await Promise.all([
      memoryStore.fetchMemories(activeCharacterId.value),
      relationshipStore.fetchProfile(activeCharacterId.value)
    ])
  } catch {
    // 错误已由 Store 暴露给页面。
  }
}

function relationshipLevelLabel(level: CharacterRelationshipLevel): string {
  return CHARACTER_RELATIONSHIP_LABELS[level]
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(new Date(value))
}

function openEdit(memory: MemoryEntry): void {
  editingMemoryId.value = memory.id
  editForm.type = normalizeType(memory.type)
  editForm.content = memory.content
  editForm.importance = memory.importance
  editDialogVisible.value = true
}

async function saveEdit(): Promise<void> {
  if (!editingMemoryId.value || !editForm.content.trim()) {
    ElMessage.warning('记忆内容不能为空')
    return
  }

  try {
    await memoryStore.updateMemory(editingMemoryId.value, {
      type: editForm.type,
      content: editForm.content.trim(),
      importance: editForm.importance
    })
    editDialogVisible.value = false
    ElMessage.success('记忆已更新')
  } catch {
    ElMessage.error(memoryStore.error || '记忆更新失败')
  }
}

async function confirmDelete(memory: MemoryEntry): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定删除这条记忆吗？\n“${memory.content}”`,
      '删除记忆',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
    await memoryStore.deleteMemory(memory.id)
    ElMessage.success('记忆已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(memoryStore.error || '记忆删除失败')
    }
  }
}

function toPercentage(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100)
}

function normalizeType(type: StoredMemoryType): MemoryType {
  return type === 'personal' ? 'personality' : type
}
</script>

<style scoped lang="scss">
.memory-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-primary);
}

.memory-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 152px 10px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  -webkit-app-region: drag;

  h2 {
    flex: 1;
    margin: 0;
    color: var(--text-primary);
    font-size: 16px;
    font-weight: 600;
    text-align: center;
  }

  .el-button { -webkit-app-region: no-drag; }
}

.memory-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: var(--text-tertiary) transparent;
  padding: 20px max(20px, calc((100% - 860px) / 2));

  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border: 2px solid transparent;
    border-radius: 999px;
    background-clip: content-box;
  }
  &::-webkit-scrollbar-thumb:hover { background-color: var(--text-tertiary); }
}

.memory-error { margin-bottom: 16px; }
.memory-section, .relationship-section { margin-bottom: 24px; }

.relationship-card :deep(.el-card__body) { padding: 16px; }
.relationship-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.relationship-stats > div { display: grid; gap: 4px; padding: 12px; border-radius: var(--radius-sm); background: var(--bg-hover); }
.relationship-stats strong { color: var(--text-primary); font-size: 14px; }
.relationship-stats span, .relationship-timeline p { margin: 0; color: var(--text-tertiary); font-size: 12px; line-height: 1.5; }
.relationship-timeline { margin: 4px 0 0; }
.milestone-list { display: grid; gap: 8px; }
.milestone-item { display: grid; gap: 4px; padding: 10px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); }
.milestone-item strong { color: var(--text-primary); font-size: 13px; }
.milestone-item span { color: var(--text-secondary); font-size: 12px; }

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
}

.memory-list { display: grid; gap: 10px; }

.memory-card :deep(.el-card__body) { padding: 16px; }
.memory-content { color: var(--text-primary); font-size: 14px; line-height: 1.7; white-space: pre-wrap; }

.memory-metrics {
  display: grid;
  grid-template-columns: 48px 1fr 42px;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  color: var(--text-secondary);
  font-size: 12px;

  .el-progress { width: 100%; }
  strong { color: var(--text-primary); text-align: right; }
}

.memory-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.sync-error { margin-top: 8px; color: var(--color-danger); font-size: 12px; }

.memory-history { margin-top: 12px; margin-bottom: 24px; }
.history-card { opacity: 0.78; }
.history-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.memory-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 8px;
}
</style>
