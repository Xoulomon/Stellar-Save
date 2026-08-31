/**
 * AWS Cost Explorer + Compute Optimizer integration.
 * Fetches cost breakdown by service, surfacing right-sizing and reservation
 * recommendations for the Stellar-Save infrastructure.
 */

import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetCostForecastCommand,
  GetDimensionValuesCommand,
  Granularity,
  type ResultByTime,
} from '@aws-sdk/client-cost-explorer';
import {
  ComputeOptimizerClient,
  GetRecommendationSummariesCommand,
  GetEC2InstanceRecommendationsCommand,
  FindingType,
} from '@aws-sdk/client-compute-optimizer';
import { Gauge, Counter } from 'prom-client';
import { registry } from './metrics';
import logger from './logger';
import { config } from './config';

// ── Prometheus metrics ────────────────────────────────────────────────────────

export const awsCostByService = new Gauge({
  name: 'aws_cost_by_service_usd',
  help: 'Actual AWS spend per service (last 30 days)',
  labelNames: ['service'],
  registers: [registry],
});

export const awsCostForecast = new Gauge({
  name: 'aws_cost_forecast_usd',
  help: 'Forecasted AWS spend for current month',
  registers: [registry],
});

export const awsOptimizationSavings = new Gauge({
  name: 'aws_optimization_savings_usd',
  help: 'Estimated monthly savings from Compute Optimizer recommendations',
  labelNames: ['finding', 'resource_type'],
  registers: [registry],
});

export const awsRecommendationCount = new Gauge({
  name: 'aws_recommendation_count',
  help: 'Number of open Compute Optimizer recommendations',
  labelNames: ['finding'],
  registers: [registry],
});

export const awsCostSpikeDetected = new Counter({
  name: 'aws_cost_spike_total',
  help: 'Number of times a cost spike was detected',
  labelNames: ['service'],
  registers: [registry],
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ServiceCost {
  service: string;
  amount: number;
  unit: string;
}

export interface CostTrend {
  period: string;
  total: number;
  byService: ServiceCost[];
}

export interface OptimizationRecommendation {
  resourceId: string;
  resourceType: string;
  finding: string;
  estimatedMonthlySavings: number;
  currentInstanceType?: string;
  recommendedInstanceType?: string;
  reason: string;
}

export interface CostReport {
  generatedAt: Date;
  last30DaysByService: ServiceCost[];
  forecastCurrentMonth: number;
  recommendations: OptimizationRecommendation[];
  totalEstimatedSavings: number;
  dailyTrend: CostTrend[];
}

// ── Client setup ──────────────────────────────────────────────────────────────

function makeCostExplorer(): CostExplorerClient {
  return new CostExplorerClient({ region: config.aws.region });
}

function makeComputeOptimizer(): ComputeOptimizerClient {
  return new ComputeOptimizerClient({ region: config.aws.region });
}

// ── Cost Explorer helpers ─────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Fetch actual cost broken down by AWS service for the last N days. */
export async function fetchCostByService(days = 30): Promise<ServiceCost[]> {
  const ce = makeCostExplorer();
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const res = await ce.send(
    new GetCostAndUsageCommand({
      TimePeriod: { Start: isoDate(start), End: isoDate(end) },
      Granularity: Granularity.MONTHLY,
      Metrics: ['UnblendedCost'],
      GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
    }),
  );

  const costs: ServiceCost[] = [];
  for (const period of res.ResultsByTime ?? []) {
    for (const group of period.Groups ?? []) {
      const service = group.Keys?.[0] ?? 'Unknown';
      const amount = parseFloat(group.Metrics?.['UnblendedCost']?.Amount ?? '0');
      const unit = group.Metrics?.['UnblendedCost']?.Unit ?? 'USD';
      if (amount > 0) costs.push({ service, amount, unit });
    }
  }
  return costs;
}

/** Fetch daily cost trend for charting. */
export async function fetchDailyTrend(days = 14): Promise<CostTrend[]> {
  const ce = makeCostExplorer();
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const res = await ce.send(
    new GetCostAndUsageCommand({
      TimePeriod: { Start: isoDate(start), End: isoDate(end) },
      Granularity: Granularity.DAILY,
      Metrics: ['UnblendedCost'],
      GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
    }),
  );

  return (res.ResultsByTime ?? []).map((period: ResultByTime) => {
    const byService: ServiceCost[] = (period.Groups ?? []).map(g => ({
      service: g.Keys?.[0] ?? 'Unknown',
      amount: parseFloat(g.Metrics?.['UnblendedCost']?.Amount ?? '0'),
      unit: g.Metrics?.['UnblendedCost']?.Unit ?? 'USD',
    }));
    const total = byService.reduce((s, c) => s + c.amount, 0);
    return { period: period.TimePeriod?.Start ?? '', total, byService };
  });
}

/** Forecast spend through end of current month. */
export async function fetchCostForecast(): Promise<number> {
  const ce = makeCostExplorer();
  const today = new Date();
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  // Forecast requires a future date range
  if (isoDate(today) >= isoDate(endOfMonth)) return 0;

  const res = await ce.send(
    new GetCostForecastCommand({
      TimePeriod: { Start: isoDate(today), End: isoDate(endOfMonth) },
      Metric: 'UNBLENDED_COST',
      Granularity: Granularity.MONTHLY,
    }),
  );
  return parseFloat(res.Total?.Amount ?? '0');
}

// ── Compute Optimizer helpers ─────────────────────────────────────────────────

/** Fetch right-sizing and reserved-instance recommendations. */
export async function fetchComputeRecommendations(): Promise<OptimizationRecommendation[]> {
  const co = makeComputeOptimizer();
  const recs: OptimizationRecommendation[] = [];

  // EC2 right-sizing recommendations
  try {
    const ec2Res = await co.send(new GetEC2InstanceRecommendationsCommand({}));
    for (const rec of ec2Res.instanceRecommendations ?? []) {
      const top = rec.recommendationOptions?.[0];
      const savings =
        top?.estimatedMonthlySavings?.value !== undefined
          ? Number(top.estimatedMonthlySavings.value)
          : 0;

      recs.push({
        resourceId: rec.instanceArn ?? '',
        resourceType: 'EC2',
        finding: rec.finding ?? 'UNKNOWN',
        estimatedMonthlySavings: savings,
        currentInstanceType: rec.currentInstanceType,
        recommendedInstanceType: top?.instanceType,
        reason: rec.findingReasonCodes?.join(', ') ?? '',
      });
    }
  } catch (err) {
    // Compute Optimizer may not be enabled in all regions
    logger.warn({ err }, 'Could not fetch EC2 recommendations from Compute Optimizer');
  }

  // Summary-level recommendations (ECS, Lambda, etc.)
  try {
    const summaryRes = await co.send(new GetRecommendationSummariesCommand({}));
    for (const summary of summaryRes.recommendationSummaries ?? []) {
      for (const finding of summary.summaries ?? []) {
        if (finding.name !== FindingType.OPTIMIZED && (finding.value ?? 0) > 0) {
          recs.push({
            resourceId: `${summary.recommendationResourceType}-summary`,
            resourceType: summary.recommendationResourceType ?? 'Unknown',
            finding: finding.name ?? 'UNKNOWN',
            estimatedMonthlySavings: 0, // summary level has no per-resource savings
            reason: `${finding.value} ${summary.recommendationResourceType} resources are ${finding.name}`,
          });
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Could not fetch recommendation summaries from Compute Optimizer');
  }

  return recs;
}

// ── Cost spike detection ──────────────────────────────────────────────────────

const PREVIOUS_TOTALS: Map<string, number> = new Map();

/**
 * Compare today's cost per service vs the previous reading.
 * Fires a Prometheus counter when spend increases > threshold (default 20%).
 */
export function detectCostSpikes(costs: ServiceCost[], thresholdPct = 20): void {
  for (const { service, amount } of costs) {
    const prev = PREVIOUS_TOTALS.get(service);
    if (prev !== undefined && prev > 0) {
      const changePct = ((amount - prev) / prev) * 100;
      if (changePct > thresholdPct) {
        logger.warn(
          { service, prev, amount, changePct },
          'AWS cost spike detected',
        );
        awsCostSpikeDetected.inc({ service });
      }
    }
    PREVIOUS_TOTALS.set(service, amount);
  }
}

// ── Main report builder ───────────────────────────────────────────────────────

/** Builds a full cost report and updates all Prometheus gauges. */
export async function buildCostReport(): Promise<CostReport> {
  const [last30DaysByService, forecastCurrentMonth, recommendations, dailyTrend] =
    await Promise.all([
      fetchCostByService(30),
      fetchCostForecast().catch(() => 0),
      fetchComputeRecommendations(),
      fetchDailyTrend(14),
    ]);

  // Update Prometheus metrics
  for (const { service, amount } of last30DaysByService) {
    awsCostByService.set({ service }, amount);
  }
  awsCostForecast.set(forecastCurrentMonth);

  for (const rec of recommendations) {
    if (rec.estimatedMonthlySavings > 0) {
      awsOptimizationSavings.set(
        { finding: rec.finding, resource_type: rec.resourceType },
        rec.estimatedMonthlySavings,
      );
    }
    awsRecommendationCount.inc({ finding: rec.finding });
  }

  detectCostSpikes(last30DaysByService);

  const totalEstimatedSavings = recommendations.reduce(
    (s, r) => s + r.estimatedMonthlySavings,
    0,
  );

  return {
    generatedAt: new Date(),
    last30DaysByService,
    forecastCurrentMonth,
    recommendations,
    totalEstimatedSavings,
    dailyTrend,
  };
}
