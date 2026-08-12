import { IsString, IsNotEmpty, IsArray, IsOptional, MaxLength, IsNumber, Min, Max } from 'class-validator'

/** 运行时模型配置（前端传入，不含凭据字段） */
export class ModelConfigDto {
  /** 指定使用哪个已配置的 Provider ID */
  @IsNumber()
  @IsOptional()
  providerId?: number

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
