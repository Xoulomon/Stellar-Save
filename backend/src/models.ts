export interface UserPreference {
  userId: string;
  minContribution?: number;
  maxContribution?: number;
  preferredDuration?: number; // in seconds
  tags: string[];
}

export interface Group {
  id: string;
  name: string;
  contributionAmount: number;
  cycleDuration: number;
  maxMembers: number;
  currentMembers: number;
  status: string;
  tags: string[];
}

export interface UserInteraction {
  userId: string;
  groupId: string;
  interactionType: 'view' | 'join' | 'contribute';
  timestamp: number;
}

export interface Member {
  id: string;
  address: string;
  name: string;
  joinedAt: number;
  groupIds: string[];
}

export interface Transaction {
  id: string;
  groupId: string;
  memberAddress: string;
  amount: number;
  type: 'contribution' | 'payout';
  timestamp: number;
  stellarTxHash: string;
}

export interface Recommendation {
  groupId: string;
  score: number;
  algorithm: string;
}

export type ExportFormat = 'CSV' | 'JSON';
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ExportJob {
  id: string;
  userId: string;
  format: ExportFormat;
  status: ExportStatus;
  createdAt: number;
  completedAt?: number;
  fileUrl?: string;
  error?: string;
}

export type BackupType = 'full' | 'incremental';
export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface BackupJob {
  id: string;
  type: BackupType;
  status: BackupStatus;
  createdAt: number;
  completedAt?: number;
  s3Key?: string;
  sizeBytes?: number;
  checksum?: string;
  baseBackupId?: string; // for incremental: the full backup it's based on
  error?: string;
}

export interface BackupAlert {
  id: string;
  backupJobId: string;
  level: 'warning' | 'error';
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

export interface AuditLog {
  id: string;
  userId: string; // The admin who performed the action
  action: string;
  targetId?: string;
  targetType?: string;
  timestamp: number;
  metadata?: any;
}
