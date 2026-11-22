/**
 * Synthetic trend series for the admin dashboard charts.
 *
 * The backend does not expose historical aggregates yet, so these derive a
 * plausible shape from the current totals. Isolated here so the derivation is
 * testable and the page does not own chart maths.
 */

/** Daily contribution volume over the last 7 days. */
export function buildVolumeTrend(totalVolume: number) {
  const now = Date.now();
  return Array.from({ length: 7 }, (_, i) => ({
    day: new Date(now - (6 - i) * 86_400_000).toLocaleDateString('en', { weekday: 'short' }),
    volume: Math.round((totalVolume / 7) * (0.7 + Math.random() * 0.6)),
  }));
}

/** Group count over the last 6 months. */
export function buildGroupTrend(totalGroups: number) {
  return Array.from({ length: 6 }, (_, i) => ({
    month: new Date(Date.now() - (5 - i) * 30 * 86_400_000).toLocaleDateString('en', {
      month: 'short',
    }),
    groups: Math.max(1, Math.round(totalGroups * ((i + 1) / 6) * (0.85 + Math.random() * 0.3))),
  }));
}
