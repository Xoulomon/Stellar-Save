export interface ContributionDataPoint {
  cycle: string; // e.g. "Jan 2025" or "Cycle 1"
  contributionRate: number; // percentage
}

export interface MemberComparisonItem {
  address: string;
  label: string; // shortened address or "You"
  onTimePercent: number;
}

export interface GroupAnalyticsStats {
  onTimePaymentRate: number; // overall on-time payment percentage for the group
  projectedCompletionDate: string; // ISO string date
}

export interface AnalyticsData {
  stats: GroupAnalyticsStats;
  history: ContributionDataPoint[];
  memberComparison: MemberComparisonItem[];
  isLoading: boolean;
  error: string | null;
}

// ─── Group Analytics ──────────────────────────────────────────────────────────

/** Contribution rate for a single completed cycle */
export interface CycleRate {
  cycleNumber: number;
  contributorsInCycle: number;
  totalMembersInCycle: number;
  /** Percentage 0–100, rounded to one decimal place */
  rate: number;
}

/** Return type of useGroupAnalytics */
export interface GroupAnalyticsResult {
  /** Per-cycle contribution rates for all completed cycles */
  cycleRates: CycleRate[];
  /** On-time payment percentage (0–100), null while loading */
  onTimePercent: number | null;
  /** Projected completion date, null if group not started */
  projectedCompletionDate: Date | null;
  isLoading: boolean;
  error: string | null;
}
