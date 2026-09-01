import { Module } from '@nestjs/common';

import { BackupMonitor } from '../../backup_monitor';
import { BackupScheduler } from '../../backup_scheduler';
import { BackupService } from '../../backup_service';

@Module({
  providers: [BackupService, BackupScheduler, BackupMonitor],
  exports: [BackupService, BackupScheduler, BackupMonitor],
})
export class BackupModule {}
