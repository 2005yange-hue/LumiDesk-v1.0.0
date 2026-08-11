import { IsString, IsNotEmpty, IsArray, IsOptional, MaxLength, IsNumber, Min, Max } from 'class-validator'

/** 运行时模型配置 */
export class ModelConfigDto {
  @IsString()
  @IsOptional()
  apiKey?: string

  @IsString()
  @IsOptional()
  apiBaseUrl?: string

  @IsString()
  @IsOptional()
  model?: string

  @IsNumber()
  @Min(0)
  @Max(2)
  @IsOptional()
  temperature?: number

  @IsNumber()
  @Min(128)
  @Max(8192)
  @IsOptional()
  maxTokens?: number
}

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  imageUrls?: string[]

  @IsOptional()
  modelConfig?: ModelConfigDto
}
