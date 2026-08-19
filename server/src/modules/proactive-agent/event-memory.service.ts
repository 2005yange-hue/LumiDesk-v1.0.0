import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { MemoryEntry } from '../memory/entities/memory-entry.entity'
import { MemoryEvent } from './entities/memory-event.entity'

/** 将带日期的 event 记忆转换为可由调度器扫描的事件。 */
@Injectable()
export class EventMemoryService {
  private readonly logger = new Logger(EventMemoryService.name)

  constructor(
    @InjectRepository(MemoryEvent)
    private readonly eventRepo: Repository<MemoryEvent>
  ) {}

  async scheduleFromMemory(memory: MemoryEntry): Promise<void> {
    if (memory.type !== 'event' || memory.status !== 'active') return

    const eventTime = this.parseEventTime(memory.content)
    if (!eventTime) return

    const now = new Date()
    const remindTime = new Date(eventTime)
    remindTime.setDate(remindTime.getDate() - 1)
    remindTime.setHours(9, 0, 0, 0)
    if (remindTime < now) remindTime.setTime(now.getTime())

    const existing = await this.eventRepo.findOne({ where: { memory_id: memory.id } })
    const event = existing ?? this.eventRepo.create({ memory_id: memory.id })
    event.event_time = eventTime
    event.remind_time = remindTime
    event.status = 'pending'
    await this.eventRepo.save(event)
    this.logger.log(`Scheduled event reminder for memory ${memory.id} at ${remindTime.toISOString()}`)
  }

  async cancelByMemoryId(memoryId: number): Promise<void> {
    await this.eventRepo.update({ memory_id: memoryId }, { status: 'cancelled' })
  }

  private parseEventTime(content: string): Date | null {
    const now = new Date()
    const date = new Date(now)
    date.setHours(9, 0, 0, 0)

    const fullDate = content.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/)
    if (fullDate) {
      date.setFullYear(Number(fullDate[1]), Number(fullDate[2]) - 1, Number(fullDate[3]))
      return date
    }

    const monthDate = content.match(/(?<!\d)(\d{1,2})月(\d{1,2})日/)
    if (monthDate) {
      date.setMonth(Number(monthDate[1]) - 1, Number(monthDate[2]))
      if (date < now) date.setFullYear(date.getFullYear() + 1)
      return date
    }

    if (/后天/.test(content)) {
      date.setDate(date.getDate() + 2)
      return date
    }
    if (/明天/.test(content)) {
      date.setDate(date.getDate() + 1)
      return date
    }
    if (/今天/.test(content)) return date

    const nextWeekday = content.match(/下周([一二三四五六日天])?/)
    if (nextWeekday) {
      const weekdayMap: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 }
      const currentDay = date.getDay()
      const nextMondayOffset = ((8 - currentDay) % 7) || 7
      date.setDate(date.getDate() + nextMondayOffset)
      if (nextWeekday[1]) {
        const weekdayOffset = weekdayMap[nextWeekday[1]] === 0 ? 6 : weekdayMap[nextWeekday[1]] - 1
        date.setDate(date.getDate() + weekdayOffset)
      }
      return date
    }

    return null
  }
}
