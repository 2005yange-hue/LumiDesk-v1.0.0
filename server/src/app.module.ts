import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { LLMModule } from './modules/llm/llm.module'
import { ChatModule } from './modules/chat/chat.module'
import { CharacterModule } from './modules/character/character.module'
import { MemoryModule } from './modules/memory/memory.module'
import { VectorMemoryModule } from './modules/vector-memory/vector-memory.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env'
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('MYSQL_HOST', 'localhost'),
        port: config.get<number>('MYSQL_PORT', 3306),
        username: config.get<string>('MYSQL_USER', 'root'),
        password: config.get<string>('MYSQL_PASSWORD', ''),
        database: config.get<string>('MYSQL_DATABASE', 'ai_companion'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('NODE_ENV') !== 'production'
      })
    }),
    LLMModule,
    ChatModule,
    CharacterModule,
    MemoryModule,
    VectorMemoryModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
