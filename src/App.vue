<template>
  <div id="app-container" :class="{ 'pet-app': isPetWindow }">
    <router-view />
    <WindowControls v-if="!isPetWindow" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useNotificationStore } from '@/stores/notification.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useCharacterStore } from '@/stores/character.store'
import { useCharacterStateStore } from '@/stores/character-state.store'
import { petEventBus } from '@/live2d/pet-event-bus'
import WindowControls from '@/components/window/WindowControls.vue'

const route = useRoute()
const notificationStore = useNotificationStore()
const settingsStore = useSettingsStore()
const characterStore = useCharacterStore()
const characterStateStore = useCharacterStateStore()
const isPetWindow = computed(() => route.meta.petWindow === true)
let notificationTimer: number | null = null

watch(
  [() => settingsStore.activeCharacterId, () => characterStore.characters],
  ([activeCharacterId, characters]) => {
    if (isPetWindow.value) return
    const character = characters.find((item) => item.id === activeCharacterId) || characters[0]
    if (!character) return
    petEventBus.publish({
      type: 'character_changed',
      payload: {
        id: character.id,
        name: character.name,
        avatarUrl: character.avatarUrl,
        appearance: character.appearance || {}
      }
    })
  },
  { immediate: true, deep: true }
)

watch(
  () => characterStateStore.state,
  (state) => {
    if (isPetWindow.value || !state) return
    petEventBus.publish({ type: 'character_state', payload: { characterId: state.character_id, mood: state.mood } })
  },
  { deep: true }
)

onMounted(() => {
  if (isPetWindow.value) return
  void notificationStore.pollSystemNotifications()
  notificationTimer = window.setInterval(() => void notificationStore.pollSystemNotifications(), 30_000)
})

onBeforeUnmount(() => {
  if (notificationTimer !== null) window.clearInterval(notificationTimer)
})
</script>

<style scoped>
#app-container { width: 100%; height: 100vh; overflow: hidden; }
#app-container.pet-app { background: transparent; }
</style>
