import { Module } from '@nestjs/common'
import { ContextWindowManager } from './context-window.manager'

@Module({
  providers: [ContextWindowManager],
  exports: [ContextWindowManager]
})
export class ContextWindowModule {}
