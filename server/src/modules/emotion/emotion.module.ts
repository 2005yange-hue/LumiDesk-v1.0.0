import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CharacterModule } from '../character/character.module'
import { EmotionContextService } from './emotion-context.service'
import { EmotionController } from './emotion.controller'
import { EmotionMaintenanceService } from './emotion-maintenance.service'
import { EmotionPreferenceService } from './emotion-preference.service'
import { EmotionRecordService } from './emotion-record.service'
import { EmotionRuleService } from './emotion-rule.service'
import { EmotionService } from './emotion.service'
import { EmotionPreference } from './entities/emotion-preference.entity'
import { EmotionRecord } from './entities/emotion-record.entity'

@Module({
  imports: [TypeOrmModule.forFeature([EmotionRecord, EmotionPreference]), CharacterModule],
  controllers: [EmotionController],
  providers: [EmotionRuleService, EmotionPreferenceService, EmotionRecordService, EmotionContextService, EmotionService, EmotionMaintenanceService],
  exports: [EmotionRuleService, EmotionRecordService, EmotionContextService, EmotionService]
})
export class EmotionModule {}