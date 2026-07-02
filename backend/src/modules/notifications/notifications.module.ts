import { Module } from '@nestjs/common';
import { NotificationService } from '../../notification_service';

@Module({
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}
