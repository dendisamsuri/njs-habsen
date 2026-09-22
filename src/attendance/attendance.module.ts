import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AttendanceController, LocationsController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceLocationService } from './attendance-location.service';
import { AttendancePhotoService } from './attendance-photo.service';
import { ProcessLogService } from './process-log.service';
import { FaceModule } from '../face/face.module';

@Module({
  imports: [FaceModule],
  controllers: [AttendanceController, LocationsController],
  providers: [AttendanceService, AttendanceLocationService, AttendancePhotoService, ProcessLogService],
  exports: [AttendanceService, AttendanceLocationService, AttendancePhotoService],
})
export class AttendanceModule {}
