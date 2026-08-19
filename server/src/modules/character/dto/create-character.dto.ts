import { IsArray, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator'

export class CreateCharacterDto {
  @IsString()
  name: string

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

  @IsObject()
  @IsOptional()
  addressingRules?: Record<string, string>

  @IsString()
  @IsOptional()
  openingMessage?: string

  @IsObject()
  @IsOptional()
  appearance?: Record<string, string>
}
