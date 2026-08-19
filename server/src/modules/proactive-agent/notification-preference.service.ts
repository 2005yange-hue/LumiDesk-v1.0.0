import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'
import { Notification, NotificationType } from './entities/notification.entity'
import { NotificationPreference } from './entities/notification-preference.entity'
import { UpdateNotificationPreferenceDto } from './dto/update-notification-preference.dto'

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

const GLOBAL_DEFAULTS: Omit<ResolvedNotificationPreference, 'characterId' | 'hasCharacterOverride'> = {
  enabled: true,
  systemEnabled: true,
  eventReminderEnabled: true,
  wellbeingCheckinEnabled: true,
  quietStart: '23:00',
  quietEnd: '08:00',
  dailyLimit: 3,
  cooldownMinutes: 720
}

@Injectable()
export class NotificationPreferenceService {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepo: Repository<NotificationPreference>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>
  ) {}

  async getGlobal(): Promise<NotificationPreference> {
    let preference = await this.preferenceRepo.findOne({ where: { user_id: 'default', character_id: IsNull() } })
    if (!preference) {
      preference = await this.preferenceRepo.save(this.preferenceRepo.create({
        user_id: 'default',
        character_id: null,
        enabled: GLOBAL_DEFAULTS.enabled,
        system_enabled: GLOBAL_DEFAULTS.systemEnabled,
        event_reminder_enabled: GLOBAL_DEFAULTS.eventReminderEnabled,
        wellbeing_checkin_enabled: GLOBAL_DEFAULTS.wellbeingCheckinEnabled,
        quiet_start: GLOBAL_DEFAULTS.quietStart,
        quiet_end: GLOBAL_DEFAULTS.quietEnd,
        daily_limit: GLOBAL_DEFAULTS.dailyLimit,
        cooldown_minutes: GLOBAL_DEFAULTS.cooldownMinutes
      }))
    }
    return preference
  }

  async updateGlobal(dto: UpdateNotificationPreferenceDto): Promise<NotificationPreference> {
    const preference = await this.getGlobal()
    this.applyDto(preference, dto)
    return this.preferenceRepo.save(preference)
  }

  async getCharacterSettings(characterId: string): Promise<{ override: NotificationPreference | null; resolved: ResolvedNotificationPreference }> {
    const override = await this.preferenceRepo.findOne({ where: { user_id: 'default', character_id: characterId } })
    return { override, resolved: await this.resolve(characterId, override) }
  }

  async updateCharacterOverride(characterId: string, dto: UpdateNotificationPreferenceDto): Promise<{ override: NotificationPreference; resolved: ResolvedNotificationPreference }> {
    let override = await this.preferenceRepo.findOne({ where: { user_id: 'default', character_id: characterId } })
    if (!override) {
      override = this.preferenceRepo.create({ user_id: 'default', character_id: characterId })
    }
    this.applyDto(override, dto)
    const saved = await this.preferenceRepo.save(override)
    return { override: saved, resolved: await this.resolve(characterId, saved) }
  }

  async deleteCharacterOverride(characterId: string): Promise<ResolvedNotificationPreference> {
    await this.preferenceRepo.delete({ user_id: 'default', character_id: characterId })
    return this.resolve(characterId)
  }

  async resolve(characterId: string, existingOverride?: NotificationPreference | null): Promise<ResolvedNotificationPreference> {
    const global = await this.getGlobal()
    const override = existingOverride === undefined
      ? await this.preferenceRepo.findOne({ where: { user_id: 'default', character_id: characterId } })
      : existingOverride
    return {
      characterId,
      enabled: override?.enabled ?? global.enabled ?? GLOBAL_DEFAULTS.enabled,
      systemEnabled: override?.system_enabled ?? global.system_enabled ?? GLOBAL_DEFAULTS.systemEnabled,
      eventReminderEnabled: override?.event_reminder_enabled ?? global.event_reminder_enabled ?? GLOBAL_DEFAULTS.eventReminderEnabled,
      wellbeingCheckinEnabled: override?.wellbeing_checkin_enabled ?? global.wellbeing_checkin_enabled ?? GLOBAL_DEFAULTS.wellbeingCheckinEnabled,
      quietStart: override?.quiet_start ?? global.quiet_start ?? GLOBAL_DEFAULTS.quietStart,
      quietEnd: override?.quiet_end ?? global.quiet_end ?? GLOBAL_DEFAULTS.quietEnd,
      dailyLimit: override?.daily_limit ?? global.daily_limit ?? GLOBAL_DEFAULTS.dailyLimit,
      cooldownMinutes: override?.cooldown_minutes ?? global.cooldown_minutes ?? GLOBAL_DEFAULTS.cooldownMinutes,
      hasCharacterOverride: Boolean(override)
    }
  }

  async canCreate(characterId: string, type: NotificationType, now = new Date()): Promise<boolean> {
    const preference = await this.resolve(characterId)
    if (!preference.enabled || this.isQuietTime(preference, now)) return false
    if (type === 'event_reminder' && !preference.eventReminderEnabled) return false
    if (type === 'wellbeing_checkin' && !preference.wellbeingCheckinEnabled) return false
    if (preference.dailyLimit <= 0) return false

    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)
    const todayCount = await this.notificationRepo
      .createQueryBuilder('notification')
      .where('notification.user_id = :userId', { userId: 'default' })
      .andWhere('notification.character_id = :characterId', { characterId })
      .andWhere('notification.created_at >= :startOfDay', { startOfDay })
      .getCount()
    if (todayCount >= preference.dailyLimit) return false

    const cooldownStart = new Date(now.getTime() - preference.cooldownMinutes * 60_000)
    return !(await this.notificationRepo
      .createQueryBuilder('notification')
      .where('notification.user_id = :userId', { userId: 'default' })
      .andWhere('notification.character_id = :characterId', { characterId })
      .andWhere('notification.created_at >= :cooldownStart', { cooldownStart })
      .getExists())
  }

  private applyDto(target: NotificationPreference, dto: UpdateNotificationPreferenceDto): void {
    if (dto.enabled !== undefined) target.enabled = dto.enabled
    if (dto.systemEnabled !== undefined) target.system_enabled = dto.systemEnabled
    if (dto.eventReminderEnabled !== undefined) target.event_reminder_enabled = dto.eventReminderEnabled
    if (dto.wellbeingCheckinEnabled !== undefined) target.wellbeing_checkin_enabled = dto.wellbeingCheckinEnabled
    if (dto.quietStart !== undefined) target.quiet_start = dto.quietStart
    if (dto.quietEnd !== undefined) target.quiet_end = dto.quietEnd
    if (dto.dailyLimit !== undefined) target.daily_limit = dto.dailyLimit
    if (dto.cooldownMinutes !== undefined) target.cooldown_minutes = dto.cooldownMinutes
  }

  private isQuietTime(preference: ResolvedNotificationPreference, now: Date): boolean {
    if (preference.quietStart === preference.quietEnd) return false
    const current = now.getHours() * 60 + now.getMinutes()
    const start = this.toMinutes(preference.quietStart)
    const end = this.toMinutes(preference.quietEnd)
    return start < end ? current >= start && current < end : current >= start || current < end
  }

  private toMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map(Number)
    return hours * 60 + minutes
  }
}
