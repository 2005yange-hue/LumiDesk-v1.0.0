import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch
} from '@nestjs/common'
import { MemoryEntry } from './entities/memory-entry.entity'
import { MemoryService } from './memory.service'
import { UpdateMemoryDto } from './dto/update-memory.dto'

@Controller('memory')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get(':characterId')
  findAll(@Param('characterId') characterId: string): Promise<MemoryEntry[]> {
    return this.memoryService.getManagedMemories(characterId)
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateMemoryDto): Promise<MemoryEntry> {
    if (dto.type === undefined && dto.content === undefined && dto.importance === undefined) {
      throw new BadRequestException('至少提供一个需要修改的字段')
    }

    return this.memoryService.updateMemory(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.memoryService.deleteMemory(id)
  }
}
