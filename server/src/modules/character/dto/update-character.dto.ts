import { IsString, IsOptional, IsNumber, IsArray, Min, Max } from 'class-validator'

/**
 * 手工定义 Partial 类型，避免额外依赖
 */
export class UpdateCharacterDto {
  @IsString()
  @IsOptional()
  name?: string

  @IsNumber()
  @Min(1)
  @Max(999)
  @IsOptional()
  age?: number

  @IsString()
  @IsOptional()
  gender?: string

  @IsString()
  @IsOptional()
  background?: string

  @IsString()
  @IsOptional()
  personality?: string

  @IsString()
  @IsOptional()
  speakingStyle?: string

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  likes?: string[]

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dislikes?: string[]
}
