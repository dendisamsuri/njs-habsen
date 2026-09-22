import { Global, Module } from '@nestjs/common';
import { NotificationsController, NotificationWriter } from './notifications.controller';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationWriter],
  exports: [NotificationWriter],
})
export class NotificationsModule {}
