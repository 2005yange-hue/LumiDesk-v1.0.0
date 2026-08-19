import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  dismissNotification,
  getNotifications,
  getUndeliveredSystemNotifications,
  markNotificationRead,
  markNotificationSystemDelivered,
  snoozeNotification
} from '@/services/notification.api'
import type { ProactiveNotification } from '@/types/notification.types'

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<ProactiveNotification[]>([])
  const loading = ref(false)
  const currentCharacterId = ref('')
  const systemPolling = ref(false)
  const unreadCount = computed(() => notifications.value.filter((notification) => notification.status === 'unread').length)

  async function fetchNotifications(characterId: string): Promise<void> {
    if (!characterId) {
      notifications.value = []
      currentCharacterId.value = ''
      return
    }
    loading.value = true
    currentCharacterId.value = characterId
    try {
      notifications.value = await getNotifications(characterId)
    } finally {
      loading.value = false
    }
  }

  async function markRead(id: number): Promise<void> {
    const updated = await markNotificationRead(id)
    replaceNotification(updated)
  }

  async function snooze(id: number, mode: 'one_hour' | 'tomorrow_morning'): Promise<void> {
    const updated = await snoozeNotification(id, mode)
    replaceNotification(updated)
  }

  async function dismiss(id: number): Promise<void> {
    const updated = await dismissNotification(id)
    replaceNotification(updated)
  }

  async function pollSystemNotifications(): Promise<void> {
    if (systemPolling.value || !window.electronAPI?.sendNotification) return
    systemPolling.value = true
    try {
      const pending = await getUndeliveredSystemNotifications()
      for (const notification of pending) {
        const delivered = await window.electronAPI.sendNotification('AI 伙伴提醒', notification.content)
        if (delivered) await markNotificationSystemDelivered(notification.id)
      }
    } finally {
      systemPolling.value = false
    }
  }

  function replaceNotification(updated: ProactiveNotification): void {
    const index = notifications.value.findIndex((notification) => notification.id === updated.id)
    if (index >= 0) notifications.value[index] = updated
  }

  return {
    notifications,
    loading,
    currentCharacterId,
    unreadCount,
    fetchNotifications,
    markRead,
    snooze,
    dismiss,
    pollSystemNotifications
  }
})
