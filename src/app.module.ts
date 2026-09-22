import { Global, Module, NestModule, MiddlewareConsumer, Inject, Optional } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { RequestContextModule, ContextMiddleware, RequestContextService, REQUEST_CONTEXT } from './common/request-context';
import { EnvelopeInterceptor } from './common/envelope.interceptor';
import { AllExceptionsFilter } from './common/exceptions';
import { PrismaModule, TenantPrismaService } from './prisma/prisma.module';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { RolesGuard } from './common/roles.guard';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MasterdataModule } from './masterdata/masterdata.module';
import { AttendanceModule } from './attendance/attendance.module';
import { FaceModule } from './face/face.module';
import { LeavesModule } from './leaves/leaves.module';
import { ReplacementOffModule } from './replacement-off/replacement-off.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { ViewsModule } from './views/views.module';
import { AsyncLocalStorage } from 'async_hooks';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RequestContextModule,
    PrismaModule,
    JwtModule.register({ global: true }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    MasterdataModule,
    AttendanceModule,
    FaceModule,
    LeavesModule,
    ReplacementOffModule,
    ApprovalsModule,
    NotificationsModule,
    ReportsModule,
    ViewsModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ContextMiddleware).forRoutes('*');
  }
}
