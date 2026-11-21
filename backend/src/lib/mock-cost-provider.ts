/**
 * Mock Cost Provider (Issue #1694)
 *
 * Test implementation of CostProvider interface.
 * Returns configurable synthetic data for testing cost management logic
 * without making actual cloud API calls.
 *
 * Usage in tests:
 *   const provider = new MockCostProvider({ totalCost: 500, recommendationCount: 3 });
 *   const report = await provider.buildCostReport();
 */

import { BaseCostProvider } from './cost-provider';
import { logger } from './logger';

import type {
  ServiceCost,
  CostTrend,
  OptimizationRecommendation,
  CostReport,
} from './cost-provider';

/**
 * Configuration for mock provider behavior
 */
export interface MockCostProviderConfig {
  totalCost?: number; // Total cost for the period (default: 1000)
  dailyTrendDays?: number; // Days to generate in daily trend (default: 14)
  recommendationCount?: number; // Number of recommendations to generate (default: 5)
  recommendationSavings?: number; // Savings per recommendation (default: 100)
  costSpikeProbability?: number; // Probability of cost spike (0-1, default: 0)
  services?: string[]; // Services to include (default: EC2, RDS, S3, Lambda, DynamoDB)
}

/**
 * Mock Cost Provider
 *
 * Generates synthetic cost and recommendation data for testing.
 * All methods are synchronous under the hood but return Promises
 * to maintain interface compatibility.
 */
export class MockCostProvider extends BaseCostProvider {
  private config: Required<MockCostProviderConfig>;

  constructor(overrides?: MockCostProviderConfig) {
    super();
    this.config = {
      totalCost: overrides?.totalCost ?? 1000,
      dailyTrendDays: overrides?.dailyTrendDays ?? 14,
      recommendationCount: overrides?.recommendationCount ?? 5,
      recommendationSavings: overrides?.recommendationSavings ?? 100,
      costSpikeProbability: overrides?.costSpikeProbability ?? 0,
      services: overrides?.services ?? ['EC2', 'RDS', 'S3', 'Lambda', 'DynamoDB'],
    };
  }

  getProviderName(): string {
    return 'Mock';
  }

  async fetchCostByService(_days = 30): Promise<ServiceCost[]> {
    const costPerService = this.config.totalCost / this.config.services.length;

    return this.config.services.map((service) => ({
      service,
      amount: costPerService * (0.8 + Math.random() * 0.4), // Add variance
      unit: 'USD',
    }));
  }

  async fetchDailyTrend(days = 14): Promise<CostTrend[]> {
    const trends: CostTrend[] = [];
    const today = new Date();

    for (let i = days; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      const dailyTotal = this.config.totalCost / 30; // Average daily cost
      const variance = 0.8 + Math.random() * 0.4;

      const byService = this.config.services.map((service) => ({
        service,
        amount: (dailyTotal / this.config.services.length) * variance,
        unit: 'USD',
      }));

      trends.push({
        period: date.toISOString().slice(0, 10),
        total: byService.reduce((sum, s) => sum + s.amount, 0),
        byService,
      });
    }

    return trends;
  }

  async fetchCostForecast(): Promise<number> {
    // Forecast for remaining days in month
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - today.getDate();
    const dailyAverage = this.config.totalCost / 30;

    return dailyAverage * daysRemaining * (0.9 + Math.random() * 0.2); // Add variance
  }

  async fetchComputeRecommendations(): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    const findings = ['UNDER_PROVISIONED', 'OVER_PROVISIONED', 'OPTIMIZED'];

    for (let i = 0; i < this.config.recommendationCount; i++) {
      const resourceType = this.config.services[i % this.config.services.length];
      const finding = findings[i % findings.length];

      recommendations.push({
        resourceId: `${resourceType.toLowerCase()}-${i}`,
        resourceType,
        finding,
        estimatedMonthlySavings: finding === 'OPTIMIZED' ? 0 : this.config.recommendationSavings,
        currentInstanceType: `${resourceType}.medium`,
        recommendedInstanceType: `${resourceType}.small`,
        reason: `${resourceType} instance ${i} is ${finding.toLowerCase()}`,
      });
    }

    return recommendations;
  }

  protected onCostSpikeDetected(
    service: string,
    previous: number,
    current: number,
    pctChange: number
  ): void {
    logger.info('[MockCostProvider] Cost spike detected', {
      service,
      previous,
      current,
      pctChange,
    });
  }

  async buildCostReport(): Promise<CostReport> {
    const [last30DaysByService, forecastCurrentMonth, recommendations, dailyTrend] =
      await Promise.all([
        this.fetchCostByService(30),
        this.fetchCostForecast(),
        this.fetchComputeRecommendations(),
        this.fetchDailyTrend(14),
      ]);

    this.detectCostSpikes(last30DaysByService);

    const totalEstimatedSavings = recommendations.reduce(
      (s, r) => s + r.estimatedMonthlySavings,
      0
    );

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

  /**
   * Helper: simulate a cost spike for testing spike detection logic
   */
  simulateCostSpike(service: string, percentIncrease: number): void {
    const costPerService = this.config.totalCost / this.config.services.length;
    const previousCost = costPerService;
    const currentCost = previousCost * (1 + percentIncrease / 100);

    this.previousTotals.set(service, previousCost);
    this.detectCostSpikes([{ service, amount: currentCost, unit: 'USD' }]);
  }
}
