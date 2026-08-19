import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { EMOTION_TYPES, EmotionType } from '../entities/emotion-record.entity'

export class UpdateEmotionRecordDto {
  @IsIn(EMOTION_TYPES)
  emotion: EmotionType

  @IsInt()
  @Min(1)
  @Max(5)
  intensity: number

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string
}