import { Gauge, Counter } from 'prom-client';
import { registry } from './metrics';

// ── GitHub Actions cost (minutes consumed) ────────────────────────────────────
export const ciMinutesUsed = new Gauge({
  name: 'ci_minutes_used_total',
  help: 'GitHub Actions minutes consumed this billing cycle',
  labelNames: ['workflow'],
  registers: [registry],
});

export const ciMinutesLimit = new Gauge({
  name: 'ci_minutes_limit_total',
  help: 'GitHub Actions minutes limit for this billing cycle',
  registers: [registry],
});

// ── Stellar transaction fees ──────────────────────────────────────────────────
export const stellarFeesXlm = new Counter({
  name: 'stellar_transaction_fees_xlm_total',
  help: 'Cumulative XLM paid in Stellar transaction fees',
  labelNames: ['network', 'operation'],
  registers: [registry],
});

export const stellarFeeUsd = new Gauge({
  name: 'stellar_fee_usd_estimate',
  help: 'Estimated USD cost of last Stellar transaction fee',
  labelNames: ['network'],
  registers: [registry],
});

// ── Storage costs ─────────────────────────────────────────────────────────────
export const storageBytesUsed = new Gauge({
  name: 'storage_bytes_used',
  help: 'Bytes used in persistent storage (backups, exports)',
  labelNames: ['type'],
  registers: [registry],
});

export const storageEstimatedCostUsd = new Gauge({
  name: 'storage_estimated_cost_usd',
  help: 'Estimated monthly USD cost for storage',
  registers: [registry],
});

// ── Total estimated monthly cost ─────────────────────────────────────────────
export const totalEstimatedMonthlyCostUsd = new Gauge({
  name: 'total_estimated_monthly_cost_usd',
  help: 'Total estimated monthly infrastructure cost in USD',
  labelNames: ['component'],
  registers: [registry],
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Record a Stellar transaction fee and update USD estimate.
 *  @param stroops  Fee in stroops (1 XLM = 10_000_000 stroops)
 *  @param xlmUsdPrice  Current XLM/USD price
 *  @param network  'testnet' | 'mainnet'
 *  @param operation  e.g. 'contribute', 'payout', 'deploy'
 */
export function recordStellarFee(
  stroops: number,
  xlmUsdPrice: number,
  network: string,
  operation: string,
): void {
  const xlm = stroops / 10_000_000;
  stellarFeesXlm.inc({ network, operation }, xlm);
  stellarFeeUsd.set({ network }, xlm * xlmUsdPrice);
}

/** Update storage cost estimate.
 *  Uses $0.023/GB/month (S3-equivalent pricing).
 */
export function updateStorageCost(backupBytes: number, exportBytes: number): void {
  storageBytesUsed.set({ type: 'backup' }, backupBytes);
  storageBytesUsed.set({ type: 'export' }, exportBytes);
  const totalGb = (backupBytes + exportBytes) / 1_073_741_824;
  const costUsd = totalGb * 0.023;
  storageEstimatedCostUsd.set(costUsd);
  totalEstimatedMonthlyCostUsd.set({ component: 'storage' }, costUsd);
}

/** Update CI cost estimate.
 *  GitHub Actions Linux minutes cost $0.008/min on paid plans.
 */
export function updateCiCost(minutesUsed: number, minutesLimit: number): void {
  ciMinutesLimit.set(minutesLimit);
  // Free tier: first 2000 min/month free; overage at $0.008/min
  const billableMinutes = Math.max(0, minutesUsed - 2000);
  const costUsd = billableMinutes * 0.008;
  totalEstimatedMonthlyCostUsd.set({ component: 'ci' }, costUsd);
}
