import { IsString, IsOptional, IsBoolean, IsInt, IsNumber, MaxLength, Min, Max } from 'class-validator'

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

  @IsOptional()
  @IsString()
  @MaxLength(32)
  provider_type?: string

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

  @IsOptional()
  @IsBoolean()
  is_default?: boolean

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  max_tokens?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  top_p?: number

  @IsOptional()
  @IsBoolean()
  stream?: boolean

  @IsOptional()
  @IsInt()
  @Min(1000)
  timeout?: number

  @IsOptional()
  @IsString()
  custom_headers?: string | null

  @IsOptional()
  @IsString()
  custom_body?: string | null
}
