import { Module } from '@nestjs/common'
import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'
import { PromptContextService } from './prompt-context.service'
import { CharacterModule } from '../character/character.module'
import { MemoryModule } from '../memory/memory.module'
import { ContextWindowModule } from '../context-window/context-window.module'
import { VectorMemoryModule } from '../vector-memory/vector-memory.module'
import { ProviderModule } from '../provider/provider.module'

@Module({
  imports: [CharacterModule, MemoryModule, ContextWindowModule, VectorMemoryModule, ProviderModule],
  controllers: [ChatController],
  providers: [ChatService, PromptContextService],
  exports: [ChatService]
})
export class ChatModule {}
