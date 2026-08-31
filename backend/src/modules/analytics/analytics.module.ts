import { Module } from '@nestjs/common';
import { AnalyticsService } from '../../analytics_service';

@Module({
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
