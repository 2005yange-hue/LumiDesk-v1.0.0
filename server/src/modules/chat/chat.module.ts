import { Module } from '@nestjs/common'
import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'
import { PromptContextService } from './prompt-context.service'
import { CharacterModule } from '../character/character.module'
import { MemoryModule } from '../memory/memory.module'

@Module({
  imports: [CharacterModule, MemoryModule],
  controllers: [ChatController],
  providers: [ChatService, PromptContextService],
  exports: [ChatService]
})
export class ChatModule {}
