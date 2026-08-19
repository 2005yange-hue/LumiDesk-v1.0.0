import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AudioController } from './audio.controller'
import { AudioService } from './audio.service'
import { AudioProvider } from './entities/audio-provider.entity'
import { GptSovitsService } from './gpt-sovits.service'

@Module({ imports: [TypeOrmModule.forFeature([AudioProvider])], controllers: [AudioController], providers: [AudioService, GptSovitsService], exports: [AudioService, GptSovitsService] })
export class AudioModule {}
