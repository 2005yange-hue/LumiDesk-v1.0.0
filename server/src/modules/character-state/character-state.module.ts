import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CharacterModule } from '../character/character.module'
import { CharacterStateController } from './character-state.controller'
import { CharacterStateService } from './character-state.service'
import { CharacterState } from './entities/character-state.entity'
import { RelationshipHistory } from './entities/relationship-history.entity'
import { RelationshipMilestone } from './entities/relationship-milestone.entity'
import { RelationshipInteraction } from './entities/relationship-interaction.entity'
import { Conversation } from '../memory/entities/conversation.entity'
import { Message } from '../memory/entities/message.entity'
import { RelationshipInteractionService } from './relationship-interaction.service'
import { RelationshipController } from './relationship.controller'
import { RelationshipEngineService } from './relationship-engine.service'
import { RelationshipEvolutionService } from './relationship-evolution.service'

@Module({
  imports: [TypeOrmModule.forFeature([CharacterState, RelationshipHistory, RelationshipMilestone, RelationshipInteraction, Conversation, Message]), CharacterModule],
  controllers: [CharacterStateController, RelationshipController],
  providers: [CharacterStateService, RelationshipEngineService, RelationshipEvolutionService, RelationshipInteractionService],
  exports: [CharacterStateService, RelationshipEvolutionService, RelationshipInteractionService]
})
export class CharacterStateModule {}
