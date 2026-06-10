import { FileService } from './file.service'
import { Module, Global } from '@nestjs/common'

@Global()
@Module({
  providers: [FileService],
  exports: [FileService]
})
export class FileModule {}
