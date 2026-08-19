import { Body, Controller, Delete, Get, Param, Post, Put, Res, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { AudioService } from './audio.service'
import { CreateAudioProviderDto } from './dto/create-audio-provider.dto'
import { UpdateAudioProviderDto } from './dto/update-audio-provider.dto'
import { TtsDto } from './dto/tts.dto'
import { SttDto } from './dto/stt.dto'
import { GptSovitsService } from './gpt-sovits.service'
import type { GptSovitsSynthesisOptions } from './gpt-sovits.service'

@Controller('audio')
export class AudioController {
  constructor(private readonly service: AudioService, private readonly gptSovits: GptSovitsService) {}

  @Get('gpt-sovits/status') status() { return this.gptSovits.status() }
  @Get('gpt-sovits/references') references() { return this.gptSovits.listReferences() }
  @Post('gpt-sovits/test') testGptSovits(@Body() dto: Partial<GptSovitsSynthesisOptions>) { return this.gptSovits.test(dto) }

  @Get('providers') list() { return this.service.list() }
  @Get('providers/active') active() { return this.service.active() }
  @Post('providers') create(@Body() dto: CreateAudioProviderDto) { return this.service.create(dto) }
  @Put('providers/:id') update(@Param('id') id: string, @Body() dto: UpdateAudioProviderDto) { return this.service.update(Number(id), dto) }
  @Delete('providers/:id') remove(@Param('id') id: string) { return this.service.remove(Number(id)).then(() => ({ success: true })) }
  @Post('providers/:id/test') test(@Param('id') id: string) { return this.service.test(Number(id)) }

  @Post('tts')
  async tts(@Body() dto: TtsDto, @Res() response: Response): Promise<void> {
    const audio = await this.service.synthesize(dto)
    response.setHeader('Content-Type', audio.contentType)
    response.setHeader('Content-Length', audio.buffer.length)
    response.setHeader('Cache-Control', 'no-store')
    response.send(audio.buffer)
  }

  @Post('stt')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 }, storage: undefined }))
  stt(@UploadedFile() file: { buffer: Buffer; mimetype: string; size: number } | undefined, @Body() dto: SttDto) { return this.service.transcribe(file, dto) }
}
