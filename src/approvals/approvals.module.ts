import { Module } from '@nestjs/common';
import { ApprovalsController } from './approvals.controller';
import { ApprovalTransitionService } from './approval-transition.service';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [AttendanceModule],
  controllers: [ApprovalsController],
  providers: [ApprovalTransitionService],
  exports: [ApprovalTransitionService],
})
export class ApprovalsModule {}
