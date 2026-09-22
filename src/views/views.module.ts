import { Module } from '@nestjs/common';
import { ViewController } from './view.controller';
import { ApprovalsModule } from '../approvals/approvals.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [ApprovalsModule, ReportsModule],
  controllers: [ViewController],
})
export class ViewsModule {}
