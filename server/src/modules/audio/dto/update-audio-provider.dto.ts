import { IsBoolean, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class UpdateAudioProviderDto {
  @IsOptional() @IsString() @MaxLength(64) name?: string
  @IsOptional() @IsString() @MaxLength(32) provider_type?: string
  @IsOptional() @IsString() @MaxLength(512) base_url?: string
  @IsOptional() @IsString() @MaxLength(512) api_key?: string
  @IsOptional() @IsString() @MaxLength(128) tts_model?: string
  @IsOptional() @IsString() @MaxLength(128) stt_model?: string
  @IsOptional() @IsString() @MaxLength(64) default_voice?: string
  @IsOptional() @IsNumber() @Min(0.25) @Max(4) default_speed?: number
  @IsOptional() @IsBoolean() enabled?: boolean
  @IsOptional() @IsBoolean() is_default?: boolean
  @IsOptional() @IsNumber() @Min(1000) @Max(120000) timeout?: number
  @IsOptional() @IsString() custom_headers?: string | null
}
