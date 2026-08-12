import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ModelProvider } from './entities/model-provider.entity'
import { ProviderService } from './provider.service'
import { ProviderController } from './provider.controller'

@Module({
  imports: [TypeOrmModule.forFeature([ModelProvider])],
  controllers: [ProviderController],
  providers: [ProviderService],
  exports: [ProviderService]
})
export class ProviderModule {}
