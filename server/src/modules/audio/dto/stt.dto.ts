import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class SttDto {
  @IsOptional() @IsInt() @Min(1) providerId?: number
  @IsOptional() @IsString() @MaxLength(16) language?: string
  @IsOptional() @IsString() @MaxLength(128) model?: string
  @IsOptional() @IsNumber() @Min(0) @Max(30_000) durationMs?: number
}
