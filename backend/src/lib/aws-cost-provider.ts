/**
 * AWS Cost Provider Implementation (Issue #1694)
 *
 * Wraps existing AWS Cost Explorer and Compute Optimizer logic
 * behind the CostProvider interface.
 *
 * Uses:
 * - AWS Cost Explorer for historical costs and forecasting
 * - AWS Compute Optimizer for right-sizing recommendations
 * - Prometheus for observability
 */

import {
  ComputeOptimizerClient,
  GetRecommendationSummariesCommand,
  GetEC2InstanceRecommendationsCommand,
  FindingType,
} from '@aws-sdk/client-compute-optimizer';
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetCostForecastCommand,
  Granularity,
  type ResultByTime,
} from '@aws-sdk/client-cost-explorer';
import { Gauge, Counter } from 'prom-client';

import { config } from '../config';
import logger from '../logger';
import { registry } from '../metrics';
import { BaseCostProvider } from './cost-provider';

import type { ServiceCost, CostTrend, OptimizationRecommendation, CostReport } from './cost-provider';

/**
 * AWS Cost Provider
 *
 * Implements CostProvider interface for AWS using:
 * - CostExplorer API for cost data
 * - ComputeOptimizer API for recommendations
 * - Prometheus for metrics
 */
export class AwsCostProvider extends BaseCostProvider {
  private ceClient: CostExplorerClient | null = null;
  private coClient: ComputeOptimizerClient | null = null;

  // Prometheus metrics
  private awsCostByService: Gauge | null = null;
  private awsCostForecast: Gauge | null = null;
  private awsOptimizationSavings: Gauge | null = null;
  private awsRecommendationCount: Gauge | null = null;
  private awsCostSpikeDetected: Counter | null = null;

  constructor() {
    super();
    this.initializeMetrics();
    this.lazyInitializeClients();
  }

  private initializeMetrics(): void {
    try {
      this.awsCostByService = new Gauge({
        name: 'aws_cost_by_service_usd',
        help: 'Actual AWS spend per service (last 30 days)',
        labelNames: ['service'],
        registers: [registry],
      });

      this.awsCostForecast = new Gauge({
        name: 'aws_cost_forecast_usd',
        help: 'Forecasted AWS spend for current month',
        registers: [registry],
      });

      this.awsOptimizationSavings = new Gauge({
        name: 'aws_optimization_savings_usd',
        help: 'Estimated monthly savings from Compute Optimizer recommendations',
        labelNames: ['finding', 'resource_type'],
        registers: [registry],
      });

      this.awsRecommendationCount = new Gauge({
        name: 'aws_recommendation_count',
        help: 'Number of open Compute Optimizer recommendations',
        labelNames: ['finding'],
        registers: [registry],
      });

      this.awsCostSpikeDetected = new Counter({
        name: 'aws_cost_spike_total',
        help: 'Number of times a cost spike was detected',
        labelNames: ['service'],
        registers: [registry],
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to initialize AWS cost provider metrics (may already exist)');
    }
  }

  private lazyInitializeClients(): void {
    if (!this.ceClient) {
      this.ceClient = new CostExplorerClient({ region: config.aws.region });
    }
    if (!this.coClient) {
      this.coClient = new ComputeOptimizerClient({ region: config.aws.region });
    }
  }

  getProviderName(): string {
    return 'AWS';
  }

  private isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  async fetchCostByService(days = 30): Promise<ServiceCost[]> {
    try {
      this.lazyInitializeClients();
      const ce = this.ceClient!;

      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - days);

      const res = await ce.send(
        new GetCostAndUsageCommand({
          TimePeriod: { Start: this.isoDate(start), End: this.isoDate(end) },
          Granularity: Granularity.MONTHLY,
          Metrics: ['UnblendedCost'],
          GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
        })
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
    } catch (err) {
      logger.error({ err }, 'Failed to fetch AWS costs by service');
      return [];
    }
  }

  async fetchDailyTrend(days = 14): Promise<CostTrend[]> {
    try {
      this.lazyInitializeClients();
      const ce = this.ceClient!;

      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - days);

      const res = await ce.send(
        new GetCostAndUsageCommand({
          TimePeriod: { Start: this.isoDate(start), End: this.isoDate(end) },
          Granularity: Granularity.DAILY,
          Metrics: ['UnblendedCost'],
          GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
        })
      );

      return (res.ResultsByTime ?? []).map((period: ResultByTime) => {
        const byService: ServiceCost[] = (period.Groups ?? []).map((g) => ({
          service: g.Keys?.[0] ?? 'Unknown',
          amount: parseFloat(g.Metrics?.['UnblendedCost']?.Amount ?? '0'),
          unit: g.Metrics?.['UnblendedCost']?.Unit ?? 'USD',
        }));
        const total = byService.reduce((s, c) => s + c.amount, 0);
        return { period: period.TimePeriod?.Start ?? '', total, byService };
      });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch AWS daily trend');
      return [];
    }
  }

  async fetchCostForecast(): Promise<number> {
    try {
      this.lazyInitializeClients();
      const ce = this.ceClient!;

      const today = new Date();
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

      if (this.isoDate(today) >= this.isoDate(endOfMonth)) return 0;

      const res = await ce.send(
        new GetCostForecastCommand({
          TimePeriod: { Start: this.isoDate(today), End: this.isoDate(endOfMonth) },
          Metric: 'UNBLENDED_COST',
          Granularity: Granularity.MONTHLY,
        })
      );
      return parseFloat(res.Total?.Amount ?? '0');
    } catch (err) {
      logger.error({ err }, 'Failed to fetch AWS cost forecast');
      return 0;
    }
  }

  async fetchComputeRecommendations(): Promise<OptimizationRecommendation[]> {
    try {
      this.lazyInitializeClients();
      const co = this.coClient!;
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
        logger.warn({ err }, 'Could not fetch EC2 recommendations from AWS Compute Optimizer');
      }

      // Summary-level recommendations
      try {
        const summaryRes = await co.send(new GetRecommendationSummariesCommand({}));
        for (const summary of summaryRes.recommendationSummaries ?? []) {
          for (const finding of summary.summaries ?? []) {
            if (finding.name !== FindingType.OPTIMIZED && (finding.value ?? 0) > 0) {
              recs.push({
                resourceId: `${summary.recommendationResourceType}-summary`,
                resourceType: summary.recommendationResourceType ?? 'Unknown',
                finding: finding.name ?? 'UNKNOWN',
                estimatedMonthlySavings: 0,
                reason: `${finding.value} ${summary.recommendationResourceType} resources are ${finding.name}`,
              });
            }
          }
        }
      } catch (err) {
        logger.warn({ err }, 'Could not fetch recommendation summaries from AWS Compute Optimizer');
      }

      return recs;
    } catch (err) {
      logger.error({ err }, 'Failed to fetch AWS recommendations');
      return [];
    }
  }

  protected onCostSpikeDetected(service: string, previous: number, current: number, pctChange: number): void {
    logger.warn(
      { service, previous, current, percentageChange: pctChange },
      'AWS cost spike detected'
    );
    if (this.awsCostSpikeDetected) {
      this.awsCostSpikeDetected.inc({ service });
    }
  }

  async buildCostReport(): Promise<CostReport> {
    const [last30DaysByService, forecastCurrentMonth, recommendations, dailyTrend] =
      await Promise.all([
        this.fetchCostByService(30),
        this.fetchCostForecast(),
        this.fetchComputeRecommendations(),
        this.fetchDailyTrend(14),
      ]);

    // Update Prometheus metrics
    if (this.awsCostByService) {
      for (const { service, amount } of last30DaysByService) {
        this.awsCostByService.set({ service }, amount);
      }
    }

    if (this.awsCostForecast) {
      this.awsCostForecast.set(forecastCurrentMonth);
    }

    if (this.awsOptimizationSavings && this.awsRecommendationCount) {
      for (const rec of recommendations) {
        if (rec.estimatedMonthlySavings > 0) {
          this.awsOptimizationSavings.set(
            { finding: rec.finding, resource_type: rec.resourceType },
            rec.estimatedMonthlySavings
          );
        }
        this.awsRecommendationCount.inc({ finding: rec.finding });
      }
    }

    this.detectCostSpikes(last30DaysByService);

    const totalEstimatedSavings = recommendations.reduce((s, r) => s + r.estimatedMonthlySavings, 0);

    return {
      generatedAt: new Date(),
      provider: this.getProviderName(),
      last30DaysByService,
      forecastCurrentMonth,
      recommendations,
      totalEstimatedSavings,
      dailyTrend,
    };
  }
}
