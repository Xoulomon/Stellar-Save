/**
 * Cost Manager (Issue #1694)
 *
 * Manages cost provider lifecycle and provides a unified interface
 * for cost operations regardless of the underlying provider implementation.
 *
 * Usage:
 *   const manager = CostManager.create('AWS');
 *   const report = await manager.buildCostReport();
 *
 * Or with dependency injection:
 *   const provider = new AwsCostProvider();
 *   const manager = new CostManager(provider);
 */

import { AwsCostProvider } from './aws-cost-provider';
import { MockCostProvider } from './mock-cost-provider';

import type {
  CostProvider,
  CostReport,
  ServiceCost,
  CostTrend,
  OptimizationRecommendation,
} from './cost-provider';
import type { MockCostProviderConfig } from './mock-cost-provider';

/**
 * Cost Manager
 *
 * Provides a high-level interface for cost management operations.
 * Delegates actual implementation to the injected CostProvider.
 */
export class CostManager {
  constructor(private provider: CostProvider) {}

  /**
   * Factory method to create a CostManager with a specific provider.
   * @param providerType Provider type ('AWS', 'Mock', etc.)
   * @param config Optional configuration for the provider
   * @returns CostManager instance
   */
  static create(providerType: string = 'AWS', config?: MockCostProviderConfig): CostManager {
    let provider: CostProvider;

    switch (providerType.toUpperCase()) {
      case 'AWS':
        provider = new AwsCostProvider();
        break;
      case 'MOCK':
        provider = new MockCostProvider(config);
        break;
      default:
        throw new Error(`Unknown cost provider type: ${providerType}`);
    }

    return new CostManager(provider);
  }

  /**
   * Get the name of the current provider.
   */
  getProviderName(): string {
    return this.provider.getProviderName();
  }

  /**
   * Fetch costs broken down by service.
   */
  async fetchCostByService(days?: number): Promise<ServiceCost[]> {
    return this.provider.fetchCostByService(days);
  }

  /**
   * Fetch daily/periodic cost trends.
   */
  async fetchDailyTrend(days?: number): Promise<CostTrend[]> {
    return this.provider.fetchDailyTrend(days);
  }

  /**
   * Fetch cost forecast for current period.
   */
  async fetchCostForecast(): Promise<number> {
    return this.provider.fetchCostForecast();
  }

  /**
   * Fetch optimization recommendations.
   */
  async fetchComputeRecommendations(): Promise<OptimizationRecommendation[]> {
    return this.provider.fetchComputeRecommendations();
  }

  /**
   * Detect and report cost spikes.
   */
  detectCostSpikes(costs: ServiceCost[], thresholdPct?: number): void {
    this.provider.detectCostSpikes(costs, thresholdPct);
  }

  /**
   * Build a comprehensive cost report.
   */
  async buildCostReport(): Promise<CostReport> {
    return this.provider.buildCostReport();
  }

  /**
   * Register provider-specific metrics (if any).
   */
  registerMetrics?(registry: unknown): void {
    this.provider.registerMetrics?.(registry);
  }

  /**
   * Switch to a different cost provider at runtime.
   * @param provider New provider instance
   */
  switchProvider(provider: CostProvider): void {
    this.provider = provider;
  }

  /**
   * Get the current provider instance (advanced usage).
   */
  getProvider(): CostProvider {
    return this.provider;
  }
}
