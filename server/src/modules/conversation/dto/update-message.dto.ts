import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class UpdateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string
}
