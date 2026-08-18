import { Module } from '@nestjs/common'
import { UserService } from './user.service'
import { UserController } from './user.controller'
import { FileModule } from '@/file/file.module'
import { ZvonokService } from '@/libs/zvonok/zvonok.service'

@Module({
  imports: [FileModule],
  controllers: [UserController],
  providers: [UserService, ZvonokService],
  exports: [UserService]
})
export class UserModule {}
