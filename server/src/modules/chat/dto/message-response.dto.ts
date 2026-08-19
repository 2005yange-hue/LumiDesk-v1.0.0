import { IsIn, IsString } from 'class-validator'

/** 历史记录中的单条消息 */
export class HistoryMessageDto {
  @IsString()
  @IsIn(['system', 'user', 'assistant'])
  role: 'system' | 'user' | 'assistant'

  @IsString()
  content: string
}

/** 对话历史回显请求 */
export class MessageResponseDto {
  @IsString()
  id: string

  @IsString()
  role: 'user' | 'assistant'

  @IsString()
  content: string

  @IsString()
  timestamp: string
}
