/// Storage Benchmarking Module
///
/// Provides utilities for benchmarking and measuring storage improvements
/// from the optimization strategies applied to the Stellar-Save contract.
///
/// All types use `no_std`-compatible primitives (no `String`, no `f64`).
use crate::storage_optimization::StorageCostAnalyzer;

/// Benchmark scenario for storage analysis.
#[derive(Clone, Debug)]
pub struct BenchmarkScenario {
    /// Name of the scenario (static string)
    pub name: &'static str,

    /// Number of members in the group
    pub member_count: u32,

    /// Number of cycles
    pub cycle_count: u32,

    /// Description of the scenario
    pub description: &'static str,
}

impl BenchmarkScenario {
    /// Creates a new benchmark scenario.
    pub fn new(
        name: &'static str,
        member_count: u32,
        cycle_count: u32,
        description: &'static str,
    ) -> Self {
        Self {
            name,
            member_count,
            cycle_count,
            description,
        }
    }
}

/// Results from a single benchmark run.
#[derive(Clone, Debug)]
pub struct BenchmarkResult {
    /// Scenario name
    pub scenario_name: &'static str,

    /// Traditional approach storage entries
    pub traditional_entries: u64,

    /// Optimized approach storage entries
    pub optimized_entries: u64,

    /// Absolute savings in entries
    pub entries_saved: u64,

    /// Percentage savings (0–100)
    pub savings_percentage: u32,

    /// Estimated annual cost (traditional) in stroops
    pub annual_cost_traditional: u64,

    /// Estimated annual cost (optimized) in stroops
    pub annual_cost_optimized: u64,

    /// Annual savings in stroops
    pub annual_savings: u64,
}

impl BenchmarkResult {
    /// Creates a new benchmark result.
    pub fn new(
        scenario_name: &'static str,
        traditional_entries: u64,
        optimized_entries: u64,
        annual_cost_traditional: u64,
        annual_cost_optimized: u64,
    ) -> Self {
        let entries_saved = traditional_entries.saturating_sub(optimized_entries);
        let savings_percentage = if traditional_entries > 0 {
            ((entries_saved * 100) / traditional_entries) as u32
        } else {
            0
        };
        let annual_savings = annual_cost_traditional.saturating_sub(annual_cost_optimized);

        Self {
            scenario_name,
            traditional_entries,
            optimized_entries,
            entries_saved,
            savings_percentage,
            annual_cost_traditional,
            annual_cost_optimized,
            annual_savings,
        }
    }
}

/// Benchmark suite for storage optimization.
pub struct StorageBenchmark;

impl StorageBenchmark {
    /// Standard benchmark scenarios covering small to enterprise-scale groups.
    pub fn standard_scenarios() -> [BenchmarkScenario; 5] {
        [
            BenchmarkScenario::new("Small Group", 10, 5, "10 members, 5 cycles"),
            BenchmarkScenario::new("Medium Group", 100, 10, "100 members, 10 cycles"),
            BenchmarkScenario::new("Large Group", 500, 25, "500 members, 25 cycles"),
            BenchmarkScenario::new("Very Large Group", 1000, 50, "1000 members, 50 cycles"),
            BenchmarkScenario::new("Enterprise Group", 5000, 100, "5000 members, 100 cycles"),
        ]
    }

    /// Runs a benchmark scenario and returns results.
    ///
    /// # Arguments
    /// * `scenario` - The benchmark scenario to run
    /// * `cost_per_entry_stroops` - Storage cost per entry in stroops
    /// * `ledgers_per_year` - Number of ledgers per year (≈5,256,000 at 6s/ledger)
    pub fn run_scenario(
        scenario: &BenchmarkScenario,
        cost_per_entry_stroops: u64,
        ledgers_per_year: u64,
    ) -> BenchmarkResult {
        let traditional = StorageCostAnalyzer::estimate_total_group_storage(
            scenario.member_count,
            scenario.cycle_count,
            false,
            false,
        );
        let optimized = StorageCostAnalyzer::estimate_total_group_storage(
            scenario.member_count,
            scenario.cycle_count,
            true,
            true,
        );

        let annual_cost_traditional = traditional
            .saturating_mul(cost_per_entry_stroops)
            .saturating_mul(ledgers_per_year);
        let annual_cost_optimized = optimized
            .saturating_mul(cost_per_entry_stroops)
            .saturating_mul(ledgers_per_year);

        BenchmarkResult::new(
            scenario.name,
            traditional,
            optimized,
            annual_cost_traditional,
            annual_cost_optimized,
        )
    }

    /// Runs all standard benchmarks and returns an array of results.
    pub fn run_all_benchmarks(
        cost_per_entry_stroops: u64,
        ledgers_per_year: u64,
    ) -> [BenchmarkResult; 5] {
        let scenarios = Self::standard_scenarios();
        [
            Self::run_scenario(&scenarios[0], cost_per_entry_stroops, ledgers_per_year),
            Self::run_scenario(&scenarios[1], cost_per_entry_stroops, ledgers_per_year),
            Self::run_scenario(&scenarios[2], cost_per_entry_stroops, ledgers_per_year),
            Self::run_scenario(&scenarios[3], cost_per_entry_stroops, ledgers_per_year),
            Self::run_scenario(&scenarios[4], cost_per_entry_stroops, ledgers_per_year),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_benchmark_scenario_creation() {
        let scenario = BenchmarkScenario::new("Test", 100, 10, "Test scenario");
        assert_eq!(scenario.member_count, 100);
        assert_eq!(scenario.cycle_count, 10);
        assert_eq!(scenario.name, "Test");
    }

    #[test]
    fn test_benchmark_result_creation() {
        let result = BenchmarkResult::new("Test", 1000, 100, 1_000_000, 100_000);
        assert_eq!(result.traditional_entries, 1000);
        assert_eq!(result.optimized_entries, 100);
        assert_eq!(result.entries_saved, 900);
        assert_eq!(result.savings_percentage, 90);
        assert_eq!(result.annual_savings, 900_000);
    }

    #[test]
    fn test_standard_scenarios() {
        let scenarios = StorageBenchmark::standard_scenarios();
        assert_eq!(scenarios.len(), 5);
        assert!(scenarios[0].member_count < scenarios[1].member_count);
        assert!(scenarios[1].member_count < scenarios[2].member_count);
        assert!(scenarios[2].member_count < scenarios[3].member_count);
        assert!(scenarios[3].member_count < scenarios[4].member_count);
    }

    #[test]
    fn test_run_scenario_shows_improvement() {
        let scenario = BenchmarkScenario::new("Test", 100, 10, "Test");
        let result = StorageBenchmark::run_scenario(&scenario, 1, 52560);
        assert!(
            result.traditional_entries > result.optimized_entries,
            "Optimized should use fewer storage entries"
        );
        assert!(
            result.savings_percentage > 0,
            "Should show positive savings percentage"
        );
    }

    #[test]
    fn test_savings_calculation() {
        let result = BenchmarkResult::new("Test", 1000, 500, 1_000_000, 500_000);
        assert_eq!(result.entries_saved, 500);
        assert_eq!(result.savings_percentage, 50);
        assert_eq!(result.annual_savings, 500_000);
    }

    #[test]
    fn test_zero_entries() {
        let result = BenchmarkResult::new("Test", 0, 0, 0, 0);
        assert_eq!(result.savings_percentage, 0);
    }

    #[test]
    fn test_run_all_benchmarks() {
        let results = StorageBenchmark::run_all_benchmarks(1, 52560);
        assert_eq!(results.len(), 5);
        for result in results.iter() {
            assert!(result.traditional_entries >= result.optimized_entries);
        }
    }
}
