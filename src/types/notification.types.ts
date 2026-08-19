export type NotificationType = 'event_reminder' | 'wellbeing_checkin'
export type NotificationStatus = 'unread' | 'read' | 'dismissed'

export interface ProactiveNotification {
  id: number
  user_id: string
  character_id: string
  type: NotificationType
  content: string
  memory_event_id: number | null
  source_memory_id: number | null
  status: NotificationStatus
  read_at: string | null
  system_notified_at: string | null
  created_at: string
  updated_at: string
}

export interface NotificationPreferenceInput {
  enabled?: boolean
  systemEnabled?: boolean
  eventReminderEnabled?: boolean
  wellbeingCheckinEnabled?: boolean
  quietStart?: string
  quietEnd?: string
  dailyLimit?: number
  cooldownMinutes?: number
}

export interface NotificationPreferenceRecord {
  id: number
  user_id: string
  character_id: string | null
  enabled: boolean | null
  system_enabled: boolean | null
  event_reminder_enabled: boolean | null
  wellbeing_checkin_enabled: boolean | null
  quiet_start: string | null
  quiet_end: string | null
  daily_limit: number | null
  cooldown_minutes: number | null
  created_at: string
  updated_at: string
}

export interface ResolvedNotificationPreference {
  characterId: string
  enabled: boolean
  systemEnabled: boolean
  eventReminderEnabled: boolean
  wellbeingCheckinEnabled: boolean
  quietStart: string
  quietEnd: string
  dailyLimit: number
  cooldownMinutes: number
  hasCharacterOverride: boolean
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  event_reminder: '事件提醒',
  wellbeing_checkin: '关切提醒'
}

export interface NotificationContext {
  notification: ProactiveNotification
  memory: { id: number; content: string; type: string } | null
  event: { id: number; event_time: string; remind_time: string; status: string } | null
  reason: string
}
