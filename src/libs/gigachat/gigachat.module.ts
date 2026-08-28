import { Module } from '@nestjs/common'
import { GigaChatService } from './gigachat.service'

@Module({
  providers: [GigaChatService],
  exports: [GigaChatService]
})
export class GigaChatModule {}
