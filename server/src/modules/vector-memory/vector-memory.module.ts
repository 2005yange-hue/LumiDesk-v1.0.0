import { Module } from '@nestjs/common'
import { VectorMemoryService } from './vector-memory.service'
import { EmbeddingService } from './embedding/embedding.service'
import { ChromaClient } from './chroma/chroma.client'

@Module({
  providers: [VectorMemoryService, EmbeddingService, ChromaClient],
  exports: [VectorMemoryService]
})
export class VectorMemoryModule {}
