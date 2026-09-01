import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { BackupModule } from './modules/backup/backup.module';
import { IndexerModule } from './modules/indexer/indexer.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WebhookModule } from './modules/webhooks/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    WebhookModule,
    AuthModule,
    AnalyticsModule,
    BackupModule,
    IndexerModule,
    NotificationsModule,
  ],
})
export class AppModule {}