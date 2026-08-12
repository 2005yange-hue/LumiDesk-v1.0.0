import { IsString, MaxLength } from 'class-validator'

export class UpdateConversationDto {
  @IsString()
  @MaxLength(200)
  title: string
}
