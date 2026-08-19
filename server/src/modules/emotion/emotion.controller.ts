import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common'
import { UpdateEmotionPreferenceDto } from './dto/update-emotion-preference.dto'
import { UpdateEmotionRecordDto } from './dto/update-emotion-record.dto'
import { EmotionPreferenceService } from './emotion-preference.service'
import { EmotionRecordService } from './emotion-record.service'

@Controller()
export class EmotionController {
  constructor(
    private readonly preferenceService: EmotionPreferenceService,
    private readonly recordService: EmotionRecordService
  ) {}

  @Get('emotion-preferences')
  getPreference() {
    return this.preferenceService.getPreference()
  }

  @Patch('emotion-preferences')
  updatePreference(@Body() dto: UpdateEmotionPreferenceDto) {
    return this.preferenceService.updatePreference(dto)
  }

  @Get('emotions/characters/:characterId')
  async list(
    @Param('characterId') characterId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const parsedPage = this.parsePositiveInt(page, 1, 1, 10_000)
    const parsedLimit = this.parsePositiveInt(limit, 50, 1, 100)
    const result = await this.recordService.list(characterId, this.parseDate(from), this.parseDate(to), parsedPage, parsedLimit)
    return { ...result, page: parsedPage, limit: parsedLimit }
  }

  @Get('emotions/characters/:characterId/summary')
  getSummary(@Param('characterId') characterId: string) {
    return this.recordService.getSummary(characterId)
  }

  @Patch('emotions/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmotionRecordDto) {
    return this.recordService.update(id, dto)
  }

  @Delete('emotions/:id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.recordService.remove(id)
    return { success: true }
  }

  @Delete('emotions/characters/:characterId')
  async clear(@Param('characterId') characterId: string) {
    await this.recordService.clearForCharacter(characterId)
    return { success: true }
  }

  private parseDate(value?: string): Date | undefined {
    if (!value) return undefined
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('日期格式无效')
    return parsed
  }

  private parsePositiveInt(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
    if (!value) return fallback
    const parsed = Number.parseInt(value, 10)
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new BadRequestException('分页参数无效')
    return parsed
  }
}