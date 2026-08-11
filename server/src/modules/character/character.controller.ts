import { Controller, Get, Post, Put, Delete, Body, Param, Logger } from '@nestjs/common'
import { CharacterService } from './character.service'
import { CreateCharacterDto } from './dto/create-character.dto'
import { UpdateCharacterDto } from './dto/update-character.dto'
import { Character } from './character.interface'

@Controller('character')
export class CharacterController {
  private readonly logger = new Logger(CharacterController.name)

  constructor(private readonly characterService: CharacterService) {}

  @Get()
  findAll(): Character[] {
    return this.characterService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string): Character | { error: string } {
    const character = this.characterService.findOne(id)
    if (!character) {
      return { error: '角色不存在' }
    }
    return character
  }

  @Post()
  create(@Body() dto: CreateCharacterDto): Character {
    return this.characterService.create(dto)
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCharacterDto
  ): Character | { error: string } {
    const updated = this.characterService.update(id, dto)
    if (!updated) {
      return { error: '角色不存在' }
    }
    return updated
  }

  @Delete(':id')
  remove(@Param('id') id: string): { success: boolean } {
    const result = this.characterService.remove(id)
    return { success: result }
  }
}
