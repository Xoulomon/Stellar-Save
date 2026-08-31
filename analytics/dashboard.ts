/**
 * Funnel Analysis Dashboard — renders conversion rates and cohort retention.
 * Closes #1172
 */

import { analyzeFunnel, cohortRetention, FUNNELS } from "./funnel";

export function renderFunnelDashboard(funnelName: keyof typeof FUNNELS, from: string, to: string): string {
  const stages = analyzeFunnel(funnelName, from, to);
  const retention = cohortRetention(funnelName);

  const stageRows = stages
    .map(
      (s) =>
        `  ${s.stage.padEnd(20)} | users: ${String(s.users).padStart(6)} | conversion: ${(s.conversionRate * 100).toFixed(1)}%`
    )
    .join("\n");

  const retentionRows = Object.entries(retention)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, counts]) => {
      const cells = Object.entries(counts)
        .map(([stage, n]) => `${stage}=${n}`)
        .join(", ");
      return `  ${week}: ${cells}`;
    })
    .join("\n");

  return [
    `=== Funnel: ${funnelName} | ${from} → ${to} ===`,
    "--- Stage Conversion ---",
    stageRows || "  (no data)",
    "--- Cohort Retention (by week) ---",
    retentionRows || "  (no data)",
  ].join("\n");
}
