import axios from 'axios'
import type {
  NotificationPreferenceInput,
  NotificationPreferenceRecord,
  ProactiveNotification,
  ResolvedNotificationPreference,
  NotificationContext
} from '@/types/notification.types'

interface Wrapped<T> {
  success: boolean
  data: T
}

export async function getNotifications(characterId: string, unreadOnly = false): Promise<ProactiveNotification[]> {
  const res = await axios.get<Wrapped<ProactiveNotification[]>>('/api/notifications/' + characterId, { params: { unreadOnly } })
  return res.data.data
}

export async function getUndeliveredSystemNotifications(): Promise<ProactiveNotification[]> {
  const res = await axios.get<Wrapped<ProactiveNotification[]>>('/api/notifications/unread')
  return res.data.data
}

export async function markNotificationRead(id: number): Promise<ProactiveNotification> {
  const res = await axios.patch<Wrapped<ProactiveNotification>>('/api/notifications/' + id + '/read')
  return res.data.data
}

export async function markNotificationSystemDelivered(id: number): Promise<ProactiveNotification> {
  const res = await axios.patch<Wrapped<ProactiveNotification>>('/api/notifications/' + id + '/system-delivered')
  return res.data.data
}

export async function snoozeNotification(id: number, mode: 'one_hour' | 'tomorrow_morning'): Promise<ProactiveNotification> {
  const res = await axios.post<Wrapped<ProactiveNotification>>('/api/notifications/' + id + '/snooze', { mode })
  return res.data.data
}

export async function dismissNotification(id: number): Promise<ProactiveNotification> {
  const res = await axios.post<Wrapped<ProactiveNotification>>('/api/notifications/' + id + '/dismiss')
  return res.data.data
}

export async function getNotificationContext(id: number): Promise<NotificationContext> {
  const res = await axios.get<Wrapped<NotificationContext>>('/api/notifications/' + id + '/context')
  return res.data.data
}

export async function getGlobalNotificationPreference(): Promise<NotificationPreferenceRecord> {
  const res = await axios.get<Wrapped<NotificationPreferenceRecord>>('/api/notification-preferences/global')
  return res.data.data
}

export async function updateGlobalNotificationPreference(input: NotificationPreferenceInput): Promise<NotificationPreferenceRecord> {
  const res = await axios.patch<Wrapped<NotificationPreferenceRecord>>('/api/notification-preferences/global', input)
  return res.data.data
}

export async function getCharacterNotificationPreference(characterId: string): Promise<{ override: NotificationPreferenceRecord | null; resolved: ResolvedNotificationPreference }> {
  const res = await axios.get<Wrapped<{ override: NotificationPreferenceRecord | null; resolved: ResolvedNotificationPreference }>>('/api/notification-preferences/characters/' + characterId)
  return res.data.data
}

export async function updateCharacterNotificationPreference(characterId: string, input: NotificationPreferenceInput): Promise<{ override: NotificationPreferenceRecord; resolved: ResolvedNotificationPreference }> {
  const res = await axios.patch<Wrapped<{ override: NotificationPreferenceRecord; resolved: ResolvedNotificationPreference }>>('/api/notification-preferences/characters/' + characterId, input)
  return res.data.data
}

export async function deleteCharacterNotificationPreference(characterId: string): Promise<ResolvedNotificationPreference> {
  const res = await axios.delete<Wrapped<ResolvedNotificationPreference>>('/api/notification-preferences/characters/' + characterId)
  return res.data.data
}
