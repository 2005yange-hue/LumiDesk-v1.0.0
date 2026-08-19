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
import { ProviderModule } from './modules/provider/provider.module'
import { ConversationModule } from './modules/conversation/conversation.module'
import { CharacterStateModule } from './modules/character-state/character-state.module'
import { EmotionModule } from './modules/emotion/emotion.module'
import { AudioModule } from './modules/audio/audio.module'
import { join, resolve } from 'node:path'

function databaseOptions(config: ConfigService) {
  const type = config.get<string>('DATABASE_TYPE', 'sqlite').toLowerCase()
  const entities = [__dirname + '/**/*.entity{.ts,.js}']
  const dataDir = config.get<string>('LUMIDESK_DATA_DIR', resolve(process.cwd(), 'data'))
  const migrationsRun = config.get<string>('DATABASE_MIGRATIONS_RUN', type === 'sqlite' ? 'true' : 'false') === 'true'

  if (type === 'mysql') {
    return {
      type: 'mysql' as const,
      host: config.get<string>('MYSQL_HOST', 'localhost'),
      port: config.get<number>('MYSQL_PORT', 3306),
      username: config.get<string>('MYSQL_USER', 'root'),
      password: config.get<string>('MYSQL_PASSWORD', ''),
      database: config.get<string>('MYSQL_DATABASE', 'ai_companion'),
      entities,
      migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
      migrationsRun,
      synchronize: config.get<string>('DATABASE_SYNCHRONIZE', 'false') === 'true',
      logging: config.get<string>('NODE_ENV') !== 'production'
    }
  }

  return {
    type: 'better-sqlite3' as const,
    database: config.get<string>('SQLITE_PATH', join(dataDir, 'lumidesk.sqlite')),
    entities,
    migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
    migrationsRun,
    synchronize: config.get<string>('DATABASE_SYNCHRONIZE', 'false') === 'true',
    logging: config.get<string>('NODE_ENV') !== 'production'
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env'
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => databaseOptions(config)
    }),
    LLMModule,
    ChatModule,
    CharacterModule,
    MemoryModule,
    VectorMemoryModule,
    ProviderModule,
    ConversationModule,
    CharacterStateModule,
    EmotionModule
    ,AudioModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
