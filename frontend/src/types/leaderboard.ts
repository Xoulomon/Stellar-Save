export type TimePeriod = 'week' | 'month' | 'all-time';

export interface LeaderboardGroup {
  rank: number;
  id: string;
  name: string;
  completionRate: number;   // 0–100
  totalCycles: number;
  completedCycles: number;
  memberCount: number;
  totalVolume: number;      // XLM
  onTimeRate: number;       // % contributions on time
  status: 'active' | 'completed' | 'pending';
  trend: 'up' | 'down' | 'stable';
}

export interface LeaderboardMember {
  rank: number;
  address: string;
  name?: string;
  totalContributed: number; // XLM
  contributionCount: number;
  onTimeRate: number;       // 0–100
  streak: number;
  groupsParticipated: number;
  trend: 'up' | 'down' | 'stable';
}

export interface LeaderboardData {
  groups: LeaderboardGroup[];
  members: LeaderboardMember[];
  period: TimePeriod;
  generatedAt: Date;
}
