import { Module } from '@nestjs/common'
import { VectorMemoryService } from './vector-memory.service'
import { EmbeddingService } from './embedding/embedding.service'
import { ChromaService } from './chroma/chroma.service'

@Module({
  providers: [VectorMemoryService, EmbeddingService, ChromaService],
  exports: [VectorMemoryService]
})
export class VectorMemoryModule {}
