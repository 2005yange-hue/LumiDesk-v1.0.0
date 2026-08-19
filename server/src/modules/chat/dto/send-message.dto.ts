import { Type } from 'class-transformer'
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator'
import { HistoryMessageDto } from './message-response.dto'

/** 运行时模型配置（前端传入，不含凭据字段） */
export class ModelConfigDto {
  /** 指定使用哪个已配置的 Provider ID */
  @IsNumber()
  @Min(1)
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

  @IsObject()
  @ValidateNested()
  @Type(() => ModelConfigDto)
  @IsOptional()
  modelConfig?: ModelConfigDto

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HistoryMessageDto)
  @IsOptional()
  history?: HistoryMessageDto[]

  @IsString()
  @MaxLength(128)
  @IsOptional()
  characterId?: string

  @IsString()
  @MaxLength(128)
  @IsOptional()
  conversationId?: string
}
