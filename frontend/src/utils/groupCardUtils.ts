const STROOPS_PER_XLM = 10_000_000;

export function formatXlm(stroops: number): string {
  return (stroops / STROOPS_PER_XLM).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function computeNextPayout(
  startedAt: Date | null,
  currentCycle: number,
  cycleDurationSecs: number,
): Date | null {
  if (!startedAt || cycleDurationSecs <= 0) return null;
  const nextCycleEnd =
    startedAt.getTime() + (currentCycle + 1) * cycleDurationSecs * 1000;
  return new Date(nextCycleEnd);
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
