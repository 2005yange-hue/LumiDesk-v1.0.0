import { Body, Controller, Get, NotFoundException, Param, Patch } from '@nestjs/common'
import { CharacterStateService } from './character-state.service'
import { UpdateInitiativeDto } from './dto/update-initiative.dto'

@Controller('character-state')
export class CharacterStateController {
  constructor(private readonly characterStateService: CharacterStateService) {}

  /** GET /api/character-state/:characterId — 获取角色当前运行态。 */
  @Get(':characterId')
  async getState(@Param('characterId') characterId: string) {
    const state = await this.characterStateService.getState(characterId)
    if (!state) throw new NotFoundException(`角色 ${characterId} 不存在`)
    return state
  }

  /** PATCH /api/character-state/:characterId/initiative — 设置主动互动等级。 */
  @Patch(':characterId/initiative')
  async updateInitiative(
    @Param('characterId') characterId: string,
    @Body() dto: UpdateInitiativeDto
  ) {
    const state = await this.characterStateService.updateInitiativeLevel(
      characterId,
      dto.initiative_level
    )
    if (!state) throw new NotFoundException(`角色 ${characterId} 不存在`)
    return state
  }
}
