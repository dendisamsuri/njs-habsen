import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { RequestContextModule, RequestContextService } from './common/request-context';
import { EnvelopeInterceptor } from './common/envelope.interceptor';
import { AllExceptionsFilter } from './common/exceptions';
import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { RolesGuard } from './common/roles.guard';
import { JwtModule } from '@nestjs/jwt';

@Global()
@Module({
  imports: [RequestContextModule, PrismaModule, JwtModule.register({ global: true })],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [RequestContextService],
})
export class CoreModule {}
