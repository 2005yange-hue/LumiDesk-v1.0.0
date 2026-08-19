import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { EmotionRecordService } from './emotion-record.service'

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000

@Injectable()
export class EmotionMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmotionMaintenanceService.name)
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly recordService: EmotionRecordService) {}

  onModuleInit(): void {
    void this.runCleanup()
    this.timer = setInterval(() => void this.runCleanup(), CLEANUP_INTERVAL_MS)
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
  }

  private async runCleanup(): Promise<void> {
    try {
      const removed = await this.recordService.cleanupExpired()
      if (removed) this.logger.log(`Removed ${removed} expired emotion records`)
    } catch (error) {
      this.logger.error('Emotion maintenance failed:', error)
    }
  }
}