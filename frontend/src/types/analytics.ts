export interface ContributionDataPoint {
  month: string; // e.g. "Jan 2025"
  contributed: number; // XLM
  received: number; // XLM
}

export interface MemberComparisonItem {
  address: string;
  label: string; // shortened address or "You"
  onTimePercent: number;
  totalContributed: number;
}

export interface AnalyticsStats {
  totalContributed: number;
  totalReceived: number;
  roi: number; // percentage
  onTimePercent: number;
  activeGroups: number;
  completedGroups: number;
}

export interface AnalyticsData {
  stats: AnalyticsStats;
  history: ContributionDataPoint[];
  memberComparison: MemberComparisonItem[];
  isLoading: boolean;
  error: string | null;
}
