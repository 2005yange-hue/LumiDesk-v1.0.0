import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Conversation } from './entities/conversation.entity'
import { Message } from './entities/message.entity'
import { MemoryService } from './memory.service'

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message])],
  providers: [MemoryService],
  exports: [MemoryService]
})
export class MemoryModule {}
