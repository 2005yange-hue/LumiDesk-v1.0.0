import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { CharacterService } from './character.service'
import { CreateCharacterDto } from './dto/create-character.dto'
import { UpdateCharacterDto } from './dto/update-character.dto'
import { Character } from './character.interface'

@Controller('character')
export class CharacterController {
  constructor(private readonly characterService: CharacterService) {}

  @Get()
  findAll(): Character[] {
    return this.characterService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string): Character {
    const character = this.characterService.findOne(id)
    if (!character) {
      throw new NotFoundException('角色不存在')
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
  ): Character {
    const updated = this.characterService.update(id, dto)
    if (!updated) {
      throw new NotFoundException('角色不存在')
    }
    return updated
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
      callback(null, allowedTypes.includes(file.mimetype))
    }
  }))
  uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string }
  ): Character {
    if (!file) {
      throw new BadRequestException('请上传 PNG、JPEG 或 WebP 格式且不超过 2 MB 的头像')
    }

    const updated = this.characterService.saveAvatar(id, file)
    if (!updated) {
      throw new NotFoundException('角色不存在')
    }
    return updated
  }

  @Delete(':id')
  remove(@Param('id') id: string): { success: boolean } {
    const result = this.characterService.remove(id)
    if (!result) {
      throw new NotFoundException('角色不存在')
    }
    return { success: result }
  }
}
