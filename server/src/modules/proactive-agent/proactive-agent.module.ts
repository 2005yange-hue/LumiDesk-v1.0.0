import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CharacterStateModule } from '../character-state/character-state.module'
import { MemoryEntry } from '../memory/entities/memory-entry.entity'
import { AgentSchedulerService } from './agent-scheduler.service'
import { EventMemoryService } from './event-memory.service'
import { InitiativePolicyService } from './initiative-policy.service'
import { MemoryEvent } from './entities/memory-event.entity'
import { Notification } from './entities/notification.entity'
import { NotificationPreference } from './entities/notification-preference.entity'
import { NotificationController } from './notification.controller'
import { NotificationPreferenceService } from './notification-preference.service'
import { NotificationService } from './notification.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([MemoryEntry, MemoryEvent, Notification, NotificationPreference]),
    CharacterStateModule
  ],
  controllers: [NotificationController],
  providers: [
    EventMemoryService,
    NotificationService,
    NotificationPreferenceService,
    InitiativePolicyService,
    AgentSchedulerService
  ],
  exports: [EventMemoryService, NotificationService]
})
export class ProactiveAgentModule {}
