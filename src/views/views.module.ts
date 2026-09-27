import { Module } from '@nestjs/common';
import { ViewController } from './view.controller';
import { ApprovalsModule } from '../approvals/approvals.module';
import { ReportsModule } from '../reports/reports.module';
import { ReplacementOffModule } from '../replacement-off/replacement-off.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ApprovalsModule, ReportsModule, ReplacementOffModule, AuthModule],
  controllers: [ViewController],
})
export class ViewsModule {}
