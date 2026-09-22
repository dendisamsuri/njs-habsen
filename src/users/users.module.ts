import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { UsersAdminController } from './users-admin.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [MeController, UsersAdminController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
