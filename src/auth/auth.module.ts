import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ThrottleService } from './throttle.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, ThrottleService],
  exports: [AuthService],
})
export class AuthModule {}
