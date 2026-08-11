import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { LLMModule } from './modules/llm/llm.module'
import { ChatModule } from './modules/chat/chat.module'

// 后续阶段将导入：
// CharacterModule, MemoryModule, VisionModule,
// AgentModule, EmotionModule, UserModule

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env'
    }),
    LLMModule,
    ChatModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
