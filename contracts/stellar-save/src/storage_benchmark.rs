/// Storage Benchmarking Module
///
/// This module provides utilities for benchmarking and measuring storage improvements
/// from the optimization strategies. It includes:
/// - Benchmark scenarios for different group sizes
/// - Storage measurement utilities
/// - Performance comparison tools
/// - Report generation

use crate::storage_optimization::StorageCostAnalyzer;
use soroban_sdk::String;

/// Benchmark scenario for storage analysis.
#[derive(Clone, Debug)]
pub struct BenchmarkScenario {
    /// Name of the scenario
    pub name: String,

    /// Number of members in the group
    pub member_count: u32,

    /// Number of cycles
    pub cycle_count: u32,

    /// Description of the scenario
    pub description: String,
}

impl BenchmarkScenario {
    /// Creates a new benchmark scenario.
    pub fn new(name: &str, member_count: u32, cycle_count: u32, description: &str) -> Self {
        Self {
            name: String::from_small_str(name),
            member_count,
            cycle_count,
            description: String::from_small_str(description),
        }
    }
}

/// Results from a single benchmark run.
#[derive(Clone, Debug)]
pub struct BenchmarkResult {
    /// Scenario name
    pub scenario_name: String,

    /// Traditional approach storage entries
    pub traditional_entries: u64,

    /// Optimized approach storage entries
    pub optimized_entries: u64,

    /// Absolute savings in entries
    pub entries_saved: u64,

    /// Percentage savings
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
        scenario_name: String,
        traditional_entries: u64,
        optimized_entries: u64,
        annual_cost_traditional: u64,
        annual_cost_optimized: u64,
    ) -> Self {
        let entries_saved = traditional_entries.saturating_sub(optimized_entries);
        let savings_percentage = if traditional_entries > 0 {
            (((entries_saved as f64 / traditional_entries as f64) * 100.0) as u32).min(100)
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
    /// Standard benchmark scenarios.
    pub fn standard_scenarios() -> [BenchmarkScenario; 5] {
        [
            BenchmarkScenario::new(
                "Small Group",
                10,
                5,
                "10 members, 5 cycles - typical small ROSCA",
            ),
            BenchmarkScenario::new(
                "Medium Group",
                100,
                10,
                "100 members, 10 cycles - typical medium ROSCA",
            ),
            BenchmarkScenario::new(
                "Large Group",
                500,
                25,
                "500 members, 25 cycles - large ROSCA",
            ),
            BenchmarkScenario::new(
                "Very Large Group",
                1000,
                50,
                "1000 members, 50 cycles - very large ROSCA",
            ),
            BenchmarkScenario::new(
                "Enterprise Group",
                5000,
                100,
                "5000 members, 100 cycles - enterprise-scale ROSCA",
            ),
        ]
    }

    /// Runs a benchmark scenario and returns results.
    ///
    /// # Arguments
    /// * `scenario` - The benchmark scenario to run
    /// * `cost_per_entry_stroops` - Storage cost per entry in stroops
    /// * `ledgers_per_year` - Number of ledgers per year
    ///
    /// # Returns
    /// Benchmark results with storage and cost analysis
    pub fn run_scenario(
        scenario: &BenchmarkScenario,
        cost_per_entry_stroops: u64,
        ledgers_per_year: u64,
    ) -> BenchmarkResult {
        // Calculate traditional storage
        let traditional = StorageCostAnalyzer::estimate_total_group_storage(
            scenario.member_count,
            scenario.cycle_count,
            false,
            false,
        );

        // Calculate optimized storage
        let optimized = StorageCostAnalyzer::estimate_total_group_storage(
            scenario.member_count,
            scenario.cycle_count,
            true,
            true,
        );

        // Calculate annual costs
        let annual_cost_traditional = traditional
            .saturating_mul(cost_per_entry_stroops)
            .saturating_mul(ledgers_per_year);

        let annual_cost_optimized = optimized
            .saturating_mul(cost_per_entry_stroops)
            .saturating_mul(ledgers_per_year);

        BenchmarkResult::new(
            scenario.name.clone(),
            traditional,
            optimized,
            annual_cost_traditional,
            annual_cost_optimized,
        )
    }

    /// Runs all standard benchmarks.
    ///
    /// # Arguments
    /// * `cost_per_entry_stroops` - Storage cost per entry in stroops
    /// * `ledgers_per_year` - Number of ledgers per year
    ///
    /// # Returns
    /// Vector of benchmark results
    pub fn run_all_benchmarks(
        cost_per_entry_stroops: u64,
        ledgers_per_year: u64,
    ) -> soroban_sdk::Vec<BenchmarkResult> {
        let scenarios = Self::standard_scenarios();
        let mut results = soroban_sdk::Vec::new(&soroban_sdk::Env::default());

        for scenario in scenarios.iter() {
            let result = Self::run_scenario(scenario, cost_per_entry_stroops, ledgers_per_year);
            results.push_back(result);
        }

        results
    }

    /// Generates a formatted benchmark report.
    ///
    /// # Arguments
    /// * `results` - Vector of benchmark results
    ///
    /// # Returns
    /// Formatted report string
    pub fn generate_report(results: &soroban_sdk::Vec<BenchmarkResult>) -> String {
        let mut report = String::new(&soroban_sdk::Env::default());

        report.append_slice("╔════════════════════════════════════════════════════════════════════════════════╗\n");
        report.append_slice("║                    STELLAR-SAVE STORAGE OPTIMIZATION BENCHMARK                 ║\n");
        report.append_slice("╚════════════════════════════════════════════════════════════════════════════════╝\n\n");

        report.append_slice("Scenario                  │ Traditional │ Optimized │ Saved  │ Savings │ Annual Savings\n");
        report.append_slice("──────────────────────────┼─────────────┼───────────┼────────┼─────────┼────────────────\n");

        for result in results.iter() {
            // Format scenario name (max 25 chars)
            let name_str = result.scenario_name.as_str();
            let name_padded = if name_str.len() > 25 {
                &name_str[..25]
            } else {
                name_str
            };

            report.append_slice(name_padded);
            report.append_slice(" │ ");

            // Traditional entries
            let trad_str = result.traditional_entries.to_string();
            report.append_slice(&trad_str);
            report.append_slice(" │ ");

            // Optimized entries
            let opt_str = result.optimized_entries.to_string();
            report.append_slice(&opt_str);
            report.append_slice(" │ ");

            // Saved entries
            let saved_str = result.entries_saved.to_string();
            report.append_slice(&saved_str);
            report.append_slice(" │ ");

            // Savings percentage
            let pct_str = result.savings_percentage.to_string();
            report.append_slice(&pct_str);
            report.append_slice("% │ ");

            // Annual savings (in stroops, convert to XLM for readability)
            let xlm_savings = result.annual_savings / 10_000_000; // 1 XLM = 10^7 stroops
            let xlm_str = xlm_savings.to_string();
            report.append_slice(&xlm_str);
            report.append_slice(" XLM\n");
        }

        report.append_slice("\n");

        // Calculate totals
        let mut total_traditional = 0u64;
        let mut total_optimized = 0u64;
        let mut total_saved = 0u64;
        let mut total_annual_savings = 0u64;

        for result in results.iter() {
            total_traditional = total_traditional.saturating_add(result.traditional_entries);
            total_optimized = total_optimized.saturating_add(result.optimized_entries);
            total_saved = total_saved.saturating_add(result.entries_saved);
            total_annual_savings = total_annual_savings.saturating_add(result.annual_savings);
        }

        report.append_slice("TOTALS                    │ ");
        report.append_slice(&total_traditional.to_string());
        report.append_slice(" │ ");
        report.append_slice(&total_optimized.to_string());
        report.append_slice(" │ ");
        report.append_slice(&total_saved.to_string());
        report.append_slice(" │ ");

        let total_pct = if total_traditional > 0 {
            (((total_saved as f64 / total_traditional as f64) * 100.0) as u32).min(100)
        } else {
            0
        };
        report.append_slice(&total_pct.to_string());
        report.append_slice("% │ ");

        let total_xlm = total_annual_savings / 10_000_000;
        report.append_slice(&total_xlm.to_string());
        report.append_slice(" XLM\n");

        report
    }

    /// Generates a detailed analysis report.
    pub fn generate_detailed_report(results: &soroban_sdk::Vec<BenchmarkResult>) -> String {
        let mut report = String::new(&soroban_sdk::Env::default());

        report.append_slice("═══════════════════════════════════════════════════════════════════════════════════\n");
        report.append_slice("DETAILED STORAGE OPTIMIZATION ANALYSIS\n");
        report.append_slice("═══════════════════════════════════════════════════════════════════════════════════\n\n");

        for (idx, result) in results.iter().enumerate() {
            report.append_slice("Scenario ");
            report.append_slice(&(idx + 1).to_string());
            report.append_slice(": ");
            report.append_slice(result.scenario_name.as_str());
            report.append_slice("\n");
            report.append_slice("───────────────────────────────────────────────────────────────────────────────────\n");

            report.append_slice("Storage Entries:\n");
            report.append_slice("  Traditional:  ");
            report.append_slice(&result.traditional_entries.to_string());
            report.append_slice(" entries\n");
            report.append_slice("  Optimized:    ");
            report.append_slice(&result.optimized_entries.to_string());
            report.append_slice(" entries\n");
            report.append_slice("  Saved:        ");
            report.append_slice(&result.entries_saved.to_string());
            report.append_slice(" entries (");
            report.append_slice(&result.savings_percentage.to_string());
            report.append_slice("%)\n\n");

            report.append_slice("Annual Costs (at 0.00001 XLM per entry per ledger):\n");
            let trad_xlm = result.annual_cost_traditional / 10_000_000;
            let opt_xlm = result.annual_cost_optimized / 10_000_000;
            let save_xlm = result.annual_savings / 10_000_000;

            report.append_slice("  Traditional:  ");
            report.append_slice(&trad_xlm.to_string());
            report.append_slice(" XLM/year\n");
            report.append_slice("  Optimized:    ");
            report.append_slice(&opt_xlm.to_string());
            report.append_slice(" XLM/year\n");
            report.append_slice("  Savings:      ");
            report.append_slice(&save_xlm.to_string());
            report.append_slice(" XLM/year\n\n");
        }

        report
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
    }

    #[test]
    fn test_benchmark_result_creation() {
        let result = BenchmarkResult::new(
            String::from_small_str("Test"),
            1000,
            100,
            1_000_000,
            100_000,
        );

        assert_eq!(result.traditional_entries, 1000);
        assert_eq!(result.optimized_entries, 100);
        assert_eq!(result.entries_saved, 900);
        assert_eq!(result.savings_percentage, 90);
    }

    #[test]
    fn test_standard_scenarios() {
        let scenarios = StorageBenchmark::standard_scenarios();
        assert_eq!(scenarios.len(), 5);

        // Verify scenarios are in increasing order
        assert!(scenarios[0].member_count < scenarios[1].member_count);
        assert!(scenarios[1].member_count < scenarios[2].member_count);
    }

    #[test]
    fn test_run_scenario() {
        let scenario = BenchmarkScenario::new("Test", 100, 10, "Test");
        let result = StorageBenchmark::run_scenario(&scenario, 1, 52560);

        assert!(result.traditional_entries > result.optimized_entries);
        assert!(result.savings_percentage > 0);
    }

    #[test]
    fn test_savings_calculation() {
        let result = BenchmarkResult::new(
            String::from_small_str("Test"),
            1000,
            500,
            1_000_000,
            500_000,
        );

        assert_eq!(result.entries_saved, 500);
        assert_eq!(result.savings_percentage, 50);
        assert_eq!(result.annual_savings, 500_000);
    }

    #[test]
    fn test_zero_entries() {
        let result = BenchmarkResult::new(
            String::from_small_str("Test"),
            0,
            0,
            0,
            0,
        );

        assert_eq!(result.savings_percentage, 0);
    }
}
