/**
 * Cloud Cost Provider Interface (Issue #1694)
 *
 * Defines a pluggable interface for cost management across multiple cloud providers.
 * Decouples the application from AWS-specific implementations and enables:
 * - Multi-cloud support (AWS, GCP, Azure, etc.)
 * - Easier testing with mock implementations
 * - Future provider swapping without code changes
 *
 * Usage:
 *   const costManager = new CostManager(new AwsCostProvider());
 *   const report = await costManager.buildCostReport();
 */

/**
 * Represents a cost breakdown for a single service/component.
 */
export interface ServiceCost {
  service: string;
  amount: number;
  unit: string;
}

/**
 * Represents cost trends over time.
 */
export interface CostTrend {
  period: string;
  total: number;
  byService: ServiceCost[];
}

/**
 * Represents a cost optimization recommendation.
 */
export interface OptimizationRecommendation {
  resourceId: string;
  resourceType: string;
  finding: string;
  estimatedMonthlySavings: number;
  currentInstanceType?: string;
  recommendedInstanceType?: string;
  reason: string;
}

/**
 * Comprehensive cost report from a provider.
 */
export interface CostReport {
  generatedAt: Date;
  provider: string; // e.g., 'AWS', 'GCP', 'Azure'
  last30DaysByService: ServiceCost[];
  forecastCurrentMonth: number;
  recommendations: OptimizationRecommendation[];
  totalEstimatedSavings: number;
  dailyTrend: CostTrend[];
}

/**
 * CostProvider Interface
 *
 * Implementations must provide methods for:
 * 1. Fetching historical costs by service
 * 2. Forecasting future costs
 * 3. Generating optimization recommendations
 * 4. Tracking cost trends
 * 5. Detecting cost anomalies
 *
 * All implementations should be:
 * - Non-blocking (async)
 * - Resilient (graceful error handling)
 * - Observable (update Prometheus metrics)
 * - Tested (comprehensive unit tests)
 */
export interface CostProvider {
  /**
   * Fetch actual spend broken down by service for the last N days.
   * @param days Number of days to look back (default: 30)
   * @returns Array of service costs
   */
  fetchCostByService(days?: number): Promise<ServiceCost[]>;

  /**
   * Fetch cost trend over time for charting/visualization.
   * @param days Number of days to look back (default: 14)
   * @returns Array of daily/periodic cost trends
   */
  fetchDailyTrend(days?: number): Promise<CostTrend[]>;

  /**
   * Forecast spend through end of current period (e.g., month).
   * @returns Forecasted total spend
   */
  fetchCostForecast(): Promise<number>;

  /**
   * Fetch optimization recommendations (right-sizing, reserved instances, etc.)
   * @returns Array of actionable recommendations
   */
  fetchComputeRecommendations(): Promise<OptimizationRecommendation[]>;

  /**
   * Detect and report cost spikes or anomalies.
   * Should update internal state and emit metrics/alerts.
   * @param costs Current service costs
   * @param thresholdPct Percentage increase to trigger spike detection (default: 20)
   */
  detectCostSpikes(costs: ServiceCost[], thresholdPct?: number): void;

  /**
   * Build a comprehensive cost report aggregating all data sources.
   * @returns Complete CostReport with all cost and recommendation data
   */
  buildCostReport(): Promise<CostReport>;

  /**
   * Register Prometheus metrics for this provider.
   * Should set up all custom metrics and gauges.
   * @param registry Prometheus registry to register metrics with
   */
  registerMetrics?(registry: unknown): void;

  /**
   * Get the human-readable name of this provider (e.g., 'AWS', 'GCP').
   * @returns Provider name
   */
  getProviderName(): string;
}

/**
 * Base class for CostProvider implementations.
 * Provides common functionality like spike detection state management.
 */
export abstract class BaseCostProvider implements CostProvider {
  protected previousTotals: Map<string, number> = new Map();

  abstract fetchCostByService(days?: number): Promise<ServiceCost[]>;
  abstract fetchDailyTrend(days?: number): Promise<CostTrend[]>;
  abstract fetchCostForecast(): Promise<number>;
  abstract fetchComputeRecommendations(): Promise<OptimizationRecommendation[]>;
  abstract buildCostReport(): Promise<CostReport>;
  abstract getProviderName(): string;

  /**
   * Default spike detection implementation.
   * Child classes can override for provider-specific logic.
   */
  detectCostSpikes(costs: ServiceCost[], thresholdPct = 20): void {
    for (const { service, amount } of costs) {
      const prev = this.previousTotals.get(service);
      if (prev !== undefined && prev > 0) {
        const changePct = ((amount - prev) / prev) * 100;
        if (changePct > thresholdPct) {
          this.onCostSpikeDetected(service, prev, amount, changePct);
        }
      }
      this.previousTotals.set(service, amount);
    }
  }

  /**
   * Called when a cost spike is detected.
   * Override in subclasses to implement provider-specific handling.
   */
  protected onCostSpikeDetected(
    _service: string,
    _previous: number,
    _current: number,
    _pctChange: number
  ): void {
    // Default: no-op. Subclasses should implement logging, alerts, metrics, etc.
  }

  registerMetrics?(_registry: unknown): void {
    // Optional: no-op by default. Subclasses can override.
  }
}
