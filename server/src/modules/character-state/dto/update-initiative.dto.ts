import { IsInt, Max, Min } from 'class-validator'

export class UpdateInitiativeDto {
  @IsInt()
  @Min(0)
  @Max(100)
  initiative_level: number
}
