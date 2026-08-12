import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator'

export class CreateProviderDto {
  @IsOptional()
  @IsString()
  user_id?: string

  @IsString()
  @MaxLength(64)
  name: string

  @IsString()
  @MaxLength(32)
  provider: string

  @IsString()
  @MaxLength(512)
  base_url: string

  @IsString()
  @MaxLength(512)
  api_key: string

  @IsString()
  @MaxLength(64)
  model: string

  @IsOptional()
  @IsBoolean()
  enabled?: boolean
}
