export interface PlatformSnapshot {
  totalUsers: number;
  activeUsers: number;
  totalGroups: number;
  activeGroups: number;
  totalContributions: number;
  totalContributionAmount: number;
  totalPayouts: number;
  totalPayoutAmount: number;
  successRate: number;
}

export interface TrendPoint extends PlatformSnapshot {
  date?: string;
}
