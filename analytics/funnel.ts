/**
 * Funnel Analytics — tracks user pathways through key funnel stages
 * and analyzes cohort retention patterns.
 * Closes #1172
 */

export type FunnelStage =
  | "landing"
  | "wallet_connect"
  | "group_view"
  | "group_join"
  | "first_contribution"
  | "payout_received";

export interface FunnelEvent {
  userId: string;
  stage: FunnelStage;
  timestamp: number;
  attributes?: Record<string, string | number | boolean>;
}

export interface CohortEntry {
  cohortDate: string; // YYYY-MM-DD
  userId: string;
  stages: Partial<Record<FunnelStage, number>>; // stage → timestamp
}

// --- Critical user journey funnels ---
export const FUNNELS: Record<string, FunnelStage[]> = {
  onboarding: ["landing", "wallet_connect", "group_view", "group_join"],
  activation: ["group_join", "first_contribution"],
  full_cycle: ["landing", "wallet_connect", "group_join", "first_contribution", "payout_received"],
};

// In-memory store (replace with persistent backend in production)
const cohortStore = new Map<string, CohortEntry>();

export function trackEvent(event: FunnelEvent): void {
  const cohortDate = new Date(event.timestamp).toISOString().slice(0, 10);
  const key = `${cohortDate}:${event.userId}`;

  const entry = cohortStore.get(key) ?? { cohortDate, userId: event.userId, stages: {} };
  entry.stages[event.stage] = event.timestamp;
  cohortStore.set(key, entry);
}

/**
 * Returns per-stage conversion rates for a named funnel within a date range.
 */
export function analyzeFunnel(
  funnelName: keyof typeof FUNNELS,
  from: string,
  to: string
): { stage: FunnelStage; users: number; conversionRate: number }[] {
  const stages = FUNNELS[funnelName];
  const entries = [...cohortStore.values()].filter(
    (e) => e.cohortDate >= from && e.cohortDate <= to
  );

  return stages.map((stage, i) => {
    const users = entries.filter((e) => e.stages[stage] !== undefined).length;
    const prev = i === 0 ? entries.length : entries.filter((e) => e.stages[stages[i - 1]] !== undefined).length;
    return { stage, users, conversionRate: prev > 0 ? users / prev : 0 };
  });
}

/**
 * Groups users by cohort week and returns stage completion counts.
 */
export function cohortRetention(
  funnelName: keyof typeof FUNNELS
): Record<string, Record<FunnelStage, number>> {
  const stages = FUNNELS[funnelName];
  const result: Record<string, Record<FunnelStage, number>> = {};

  for (const entry of cohortStore.values()) {
    const week = getISOWeek(entry.cohortDate);
    if (!result[week]) result[week] = {} as Record<FunnelStage, number>;
    for (const stage of stages) {
      result[week][stage] = (result[week][stage] ?? 0) + (entry.stages[stage] !== undefined ? 1 : 0);
    }
  }
  return result;
}

/**
 * Segments funnel results by a user attribute key.
 */
export function segmentFunnel(
  events: FunnelEvent[],
  funnelName: keyof typeof FUNNELS,
  segmentKey: string
): Record<string, ReturnType<typeof analyzeFunnel>> {
  const segments = new Map<string, FunnelEvent[]>();
  for (const e of events) {
    const val = String(e.attributes?.[segmentKey] ?? "unknown");
    const list = segments.get(val) ?? [];
    list.push(e);
    segments.set(val, list);
  }

  const out: Record<string, ReturnType<typeof analyzeFunnel>> = {};
  for (const [seg, segEvents] of segments) {
    // Temporarily load segment events into a fresh store context
    const saved = new Map(cohortStore);
    cohortStore.clear();
    segEvents.forEach(trackEvent);
    out[seg] = analyzeFunnel(funnelName, "0000-00-00", "9999-12-31");
    cohortStore.clear();
    for (const [k, v] of saved) cohortStore.set(k, v);
  }
  return out;
}

function getISOWeek(dateStr: string): string {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}
