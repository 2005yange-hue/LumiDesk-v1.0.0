import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { LLMModule } from './modules/llm/llm.module'
import { ChatModule } from './modules/chat/chat.module'
import { CharacterModule } from './modules/character/character.module'

// 后续阶段将导入：
// MemoryModule, VisionModule,
// AgentModule, EmotionModule, UserModule

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env'
    }),
    LLMModule,
    ChatModule,
    CharacterModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
