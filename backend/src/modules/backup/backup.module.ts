import { Module } from '@nestjs/common';
import { BackupService } from '../../backup_service';
import { BackupScheduler } from '../../backup_scheduler';
import { BackupMonitor } from '../../backup_monitor';

@Module({
  providers: [BackupService, BackupScheduler, BackupMonitor],
  exports: [BackupService, BackupScheduler, BackupMonitor],
})
export class BackupModule {}
