export { formatXlm, formatShortDate as formatDate } from '../lib/formatters';

export function computeNextPayout(
  startedAt: Date | null,
  currentCycle: number,
  cycleDurationSecs: number
): Date | null {
  if (!startedAt || cycleDurationSecs <= 0) return null;
  const nextCycleEnd = startedAt.getTime() + (currentCycle + 1) * cycleDurationSecs * 1000;
  return new Date(nextCycleEnd);
}
