import { IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { MEMORY_TYPES, MemoryType } from '../entities/memory-entry.entity'

export class UpdateMemoryDto {
  @IsOptional()
  @IsEnum(MEMORY_TYPES)
  type?: MemoryType

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  importance?: number
}
