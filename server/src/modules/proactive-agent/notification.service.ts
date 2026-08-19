import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'
import { MemoryEntry } from '../memory/entities/memory-entry.entity'
import { MemoryEvent } from './entities/memory-event.entity'
import { Notification, NotificationType } from './entities/notification.entity'

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(MemoryEntry)
    private readonly memoryRepo: Repository<MemoryEntry>,
    @InjectRepository(MemoryEvent)
    private readonly eventRepo: Repository<MemoryEvent>
  ) {}

  async create(params: { characterId: string; type: NotificationType; content: string; memoryEventId?: number | null; sourceMemoryId?: number | null }): Promise<Notification> {
    return this.notificationRepo.save(this.notificationRepo.create({
      user_id: 'default',
      character_id: params.characterId,
      type: params.type,
      content: params.content,
      memory_event_id: params.memoryEventId ?? null,
      source_memory_id: params.sourceMemoryId ?? null,
      status: 'unread',
      read_at: null,
      system_notified_at: null
    }))
  }

  async findByCharacter(characterId: string, unreadOnly = false): Promise<Notification[]> {
    const query = this.notificationRepo
      .createQueryBuilder('notification')
      .where('notification.user_id = :userId', { userId: 'default' })
      .andWhere('notification.character_id = :characterId', { characterId })
      .orderBy('notification.created_at', 'DESC')
      .take(50)
    if (unreadOnly) query.andWhere('notification.status = :status', { status: 'unread' })
    return query.getMany()
  }

  async findUnreadForSystem(): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { user_id: 'default', status: 'unread', system_notified_at: IsNull() },
      order: { created_at: 'ASC' },
      take: 100
    })
  }

  async markRead(id: string): Promise<Notification> {
    const notification = await this.findOwned(id)
    if (notification.status === 'read') return notification
    notification.status = 'read'
    notification.read_at = new Date()
    return this.notificationRepo.save(notification)
  }

  async markSystemDelivered(id: string): Promise<Notification> {
    const notification = await this.findOwned(id)
    if (!notification.system_notified_at) {
      notification.system_notified_at = new Date()
      return this.notificationRepo.save(notification)
    }
    return notification
  }

  async dismiss(id: string): Promise<Notification> {
    const notification = await this.findOwned(id)
    if (notification.memory_event_id) {
      const event = await this.eventRepo.findOne({ where: { id: notification.memory_event_id } })
      if (event) {
        event.status = 'cancelled'
        await this.eventRepo.save(event)
      }
    }
    notification.status = 'dismissed'
    notification.read_at = new Date()
    return this.notificationRepo.save(notification)
  }

  async snooze(id: string, mode: 'one_hour' | 'tomorrow_morning'): Promise<Notification> {
    const notification = await this.findOwned(id)
    if (!notification.memory_event_id) throw new BadRequestException('只有事件提醒支持稍后提醒')
    const event = await this.eventRepo.findOne({ where: { id: notification.memory_event_id } })
    if (!event) throw new NotFoundException('关联事件不存在')

    const next = new Date()
    if (mode === 'one_hour') {
      next.setHours(next.getHours() + 1, 0, 0, 0)
    } else {
      next.setDate(next.getDate() + 1)
      next.setHours(9, 0, 0, 0)
    }
    event.status = 'pending'
    event.remind_time = next
    await this.eventRepo.save(event)

    notification.status = 'dismissed'
    notification.read_at = new Date()
    return this.notificationRepo.save(notification)
  }

  async getContext(id: string): Promise<{ notification: Notification; memory: MemoryEntry | null; event: MemoryEvent | null; reason: string }> {
    const notification = await this.findOwned(id)
    const memory = notification.source_memory_id
      ? await this.memoryRepo.findOne({ where: { id: notification.source_memory_id } })
      : null
    const event = notification.memory_event_id
      ? await this.eventRepo.findOne({ where: { id: notification.memory_event_id } })
      : null
    const reason = notification.type === 'event_reminder'
      ? '此提醒来自事件记忆：' + (memory?.content || '关联事件') + (event ? '。计划时间：' + event.event_time.toLocaleString('zh-CN') : '')
      : '此关切来自近期事件记忆：' + (memory?.content || '系统检测到你此前提到的压力或重要事项')
    return { notification, memory, event, reason }
  }

  async hasNotificationForSource(memoryId: number): Promise<boolean> {
    return this.notificationRepo.exists({ where: { source_memory_id: memoryId } })
  }

  private async findOwned(id: string): Promise<Notification> {
    const notificationId = Number(id)
    const notification = await this.notificationRepo.findOne({ where: { id: notificationId, user_id: 'default' } })
    if (!notification) throw new NotFoundException('通知不存在')
    return notification
  }
}
