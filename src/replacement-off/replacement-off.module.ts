import { Module } from '@nestjs/common';
import {
  ReplacementOffController,
  ReplacementOffAdminController,
} from './replacement-off.controller';
import { ReplacementOffService } from './replacement-off.service';

@Module({
  controllers: [ReplacementOffController, ReplacementOffAdminController],
  providers: [ReplacementOffService],
  exports: [ReplacementOffService],
})
export class ReplacementOffModule {}
