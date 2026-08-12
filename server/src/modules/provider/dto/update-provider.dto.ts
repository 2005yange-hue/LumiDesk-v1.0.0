import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator'

export class UpdateProviderDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(32)
  provider?: string

  @IsOptional()
  @IsString()
  @MaxLength(512)
  base_url?: string

  @IsOptional()
  @IsString()
  @MaxLength(512)
  api_key?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  model?: string

  @IsOptional()
  @IsBoolean()
  enabled?: boolean
}
