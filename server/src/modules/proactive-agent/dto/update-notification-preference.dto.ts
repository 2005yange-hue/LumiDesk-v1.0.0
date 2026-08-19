import { IsBoolean, IsInt, IsOptional, Matches, Max, Min } from 'class-validator'

export class UpdateNotificationPreferenceDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean

  @IsBoolean()
  @IsOptional()
  systemEnabled?: boolean

  @IsBoolean()
  @IsOptional()
  eventReminderEnabled?: boolean

  @IsBoolean()
  @IsOptional()
  wellbeingCheckinEnabled?: boolean

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  @IsOptional()
  quietStart?: string

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  @IsOptional()
  quietEnd?: string

  @IsInt()
  @Min(0)
  @Max(20)
  @IsOptional()
  dailyLimit?: number

  @IsInt()
  @Min(15)
  @Max(1440)
  @IsOptional()
  cooldownMinutes?: number
}
