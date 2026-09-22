import { Module } from '@nestjs/common';
import { FaceController } from './face.controller';
import { FaceService } from './face.service';

@Module({
  controllers: [FaceController],
  providers: [FaceService],
  exports: [FaceService],
})
export class FaceModule {}
