import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class TtsDto {
  @IsOptional() @IsIn(['provider', 'gpt-sovits']) engine?: 'provider' | 'gpt-sovits'
  @IsString() @MaxLength(8000) text: string
  @IsOptional() @IsInt() @Min(1) providerId?: number
  @IsOptional() @IsString() @MaxLength(64) voice?: string
  @IsOptional() @IsNumber() @Min(0.25) @Max(4) speed?: number
  @IsOptional() @IsIn(['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm']) format?: string
  @IsOptional() @IsString() @MaxLength(16) textLang?: string
  @IsOptional() @IsString() @MaxLength(255) referenceId?: string
  @IsOptional() @IsString() @MaxLength(2000) promptText?: string
  @IsOptional() @IsString() @MaxLength(16) promptLang?: string
}
