import { IsBoolean } from 'class-validator'

export class UpdateEmotionPreferenceDto {
  @IsBoolean()
  enabled: boolean
}