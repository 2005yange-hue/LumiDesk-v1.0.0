import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { LessThanOrEqual, Repository } from 'typeorm'
import { CharacterStateService } from '../character-state/character-state.service'
import { MemoryEntry } from '../memory/entities/memory-entry.entity'
import { InitiativePolicyService } from './initiative-policy.service'
import { MemoryEvent } from './entities/memory-event.entity'
import { NotificationPreferenceService } from './notification-preference.service'
import { NotificationService } from './notification.service'

const SCAN_INTERVAL_MS = 15 * 60 * 1000

/** 调度可提醒事件与低频关切消息，绝不生成无理由的日常问候。 */
@Injectable()
export class AgentSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentSchedulerService.name)
  private timer: NodeJS.Timeout | null = null

  constructor(
    @InjectRepository(MemoryEvent)
    private readonly eventRepo: Repository<MemoryEvent>,
    @InjectRepository(MemoryEntry)
    private readonly memoryRepo: Repository<MemoryEntry>,
    private readonly characterStateService: CharacterStateService,
    private readonly initiativePolicy: InitiativePolicyService,
    private readonly preferenceService: NotificationPreferenceService,
    private readonly notificationService: NotificationService
  ) {}

  onModuleInit(): void {
    void this.runScheduledWork()
    this.timer = setInterval(() => void this.runScheduledWork(), SCAN_INTERVAL_MS)
    this.logger.log('Proactive scan scheduled every 15 minutes')
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
  }

  async runScheduledWork(): Promise<void> {
    try {
      await this.processDueEventReminders()
      await this.processWellbeingCheckIns()
    } catch (error) {
      this.logger.error('Proactive scheduler failed:', error)
    }
  }

  private async processDueEventReminders(): Promise<void> {
    const now = new Date()
    const dueEvents = await this.eventRepo.find({ where: { status: 'pending', remind_time: LessThanOrEqual(now) }, take: 100, order: { remind_time: 'ASC' } })
    for (const event of dueEvents) {
      const memory = await this.memoryRepo.findOne({ where: { id: event.memory_id, status: 'active' } })
      if (!memory || !memory.character_id) {
        event.status = 'cancelled'
        await this.eventRepo.save(event)
        continue
      }
      if (!(await this.canNotify(memory.character_id, 'event_reminder', now))) continue
      const notification = await this.notificationService.create({
        characterId: memory.character_id,
        type: 'event_reminder',
        content: this.buildEventMessage(memory.content, event.event_time, now),
        memoryEventId: event.id,
        sourceMemoryId: memory.id
      })
      event.status = 'sent'
      await this.eventRepo.save(event)
      this.logger.log(`Created event reminder notification ${notification.id} for memory ${memory.id}`)
    }
  }

  private async processWellbeingCheckIns(): Promise<void> {
    const now = new Date()
    const earliest = new Date(now.getTime() - 3 * 86_400_000)
    const latest = new Date(now.getTime() - 18 * 60 * 60 * 1000)
    const candidates = await this.memoryRepo.createQueryBuilder('memory')
      .where('memory.status = :status', { status: 'active' })
      .andWhere('memory.type = :type', { type: 'event' })
      .andWhere('memory.created_at BETWEEN :earliest AND :latest', { earliest, latest })
      .orderBy('memory.created_at', 'ASC')
      .take(50)
      .getMany()
    for (const memory of candidates) {
      if (!memory.character_id || !this.isWellbeingConcern(memory.content)) continue
      if (await this.notificationService.hasNotificationForSource(memory.id)) continue
      if (!(await this.canNotify(memory.character_id, 'wellbeing_checkin', now))) continue
      await this.notificationService.create({
        characterId: memory.character_id,
        type: 'wellbeing_checkin',
        content: '昨天你提到' + this.trimContent(memory.content) + '，今天状态怎么样？',
        sourceMemoryId: memory.id
      })
    }
  }

  private async canNotify(characterId: string, type: 'event_reminder' | 'wellbeing_checkin', now: Date): Promise<boolean> {
    const state = await this.characterStateService.getState(characterId)
    if (!state || !this.initiativePolicy.canInitiate(state)) return false
    return this.preferenceService.canCreate(characterId, type, now)
  }

  private buildEventMessage(content: string, eventTime: Date, now: Date): string {
    const daysUntil = Math.ceil((this.startOfDay(eventTime).getTime() - this.startOfDay(now).getTime()) / 86_400_000)
    const timeLabel = daysUntil <= 0 ? '今天' : daysUntil === 1 ? '明天' : `${daysUntil} 天后`
    return `${timeLabel}${this.trimContent(content)}，希望一切顺利。`
  }

  private isWellbeingConcern(content: string): boolean {
    return /(考试|面试|答辩|截止|压力|焦虑|紧张|担心)/.test(content)
  }

  private trimContent(content: string): string {
    return content.replace(/^用户/, '').replace(/[。！？!?]$/, '').slice(0, 72)
  }

  private startOfDay(date: Date): Date {
    const value = new Date(date)
    value.setHours(0, 0, 0, 0)
    return value
  }
}
