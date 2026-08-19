import { Controller, Get, NotFoundException, Param } from '@nestjs/common'
import { CharacterStateService } from './character-state.service'
import { RelationshipEvolutionService } from './relationship-evolution.service'

@Controller('relationship')
export class RelationshipController {
  constructor(
    private readonly characterStateService: CharacterStateService,
    private readonly relationshipEvolutionService: RelationshipEvolutionService
  ) {}

  @Get(':characterId')
  async getProfile(@Param('characterId') characterId: string) {
    const state = await this.characterStateService.getState(characterId)
    if (!state) throw new NotFoundException('角色不存在：' + characterId)
    return this.relationshipEvolutionService.getProfile(state)
  }
}
