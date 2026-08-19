import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Conversation } from '../memory/entities/conversation.entity'
import { Message } from '../memory/entities/message.entity'
import { ConversationSummaryService } from './conversation-summary.service'

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message])],
  providers: [ConversationSummaryService],
  exports: [ConversationSummaryService]
})
export class ConversationSummaryModule {}
