import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class CreateAudioProviderDto {
  @IsOptional() @IsString() @MaxLength(36) user_id?: string
  @IsString() @MaxLength(64) name: string
  @IsOptional() @IsString() @MaxLength(32) provider_type?: string
  @IsString() @MaxLength(512) base_url: string
  @IsString() @MaxLength(512) api_key: string
  @IsString() @MaxLength(128) tts_model: string
  @IsString() @MaxLength(128) stt_model: string
  @IsOptional() @IsString() @MaxLength(64) default_voice?: string
  @IsOptional() @IsNumber() @Min(0.25) @Max(4) default_speed?: number
  @IsOptional() @IsBoolean() enabled?: boolean
  @IsOptional() @IsBoolean() is_default?: boolean
  @IsOptional() @IsInt() @Min(1000) @Max(120000) timeout?: number
  @IsOptional() @IsString() custom_headers?: string | null
}
