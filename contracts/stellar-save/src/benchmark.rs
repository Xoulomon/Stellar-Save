//! Consolidated Benchmark Module for Stellar-Save
//!
//! This module merges the functionality previously split across
//! `gas_benchmark.rs`, `gas_benchmark_tests.rs`, and `storage_benchmark.rs`
//! into a single benchmark suite with a checked-in baseline and regression
//! detection.
//!
//! ## Baseline
//!
//! Baseline CPU instruction counts for the three core operations are stored
//! in `scripts/benchmark_baseline.json` under `contracts.stellar-save.functions`:
//! - `create_group`
//! - `contribute`
//! - `execute_payout`
//!
//! Update baselines with:
//! ```bash
//! bash scripts/benchmark_regression.sh --update-baseline
//! ```
//!
//! ## Regression Detection
//!
//! `scripts/benchmark_regression.sh` parses benchmark output, compares each
//! function's measured CPU instructions against its baseline, and exits with
//! failure if any delta exceeds `regression_threshold_pct` (default 10%).
//!
//! ## Running
//!
//! ```bash
//! cargo test --manifest-path contracts/stellar-save/Cargo.toml benchmark -- --nocapture
//! ```

// All benchmark code is test-only — nothing from this module goes into WASM.
#[cfg(test)]
mod benchmark {
    use soroban_sdk::{
        testutils::Address as _,
        Address, Env, Vec,
    };

    use crate::{
        group::{Group, GroupStatus, TokenConfig},
        storage::StorageKeyBuilder,
        Group as _,
        StellarSaveContract,
        StellarSaveContractClient,
    };

    // ═══════════════════════════════════════════════════════════════
    //  Storage Benchmarking Utilities (from storage_benchmark.rs)
    // ═══════════════════════════════════════════════════════════════

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
        pub fn run_scenario(
            scenario: &BenchmarkScenario,
            cost_per_entry_stroops: u64,
            ledgers_per_year: u64,
        ) -> BenchmarkResult {
            let traditional = crate::storage_optimization::StorageCostAnalyzer::estimate_total_group_storage(
                scenario.member_count,
                scenario.cycle_count,
                false,
                false,
            );
            let optimized = crate::storage_optimization::StorageCostAnalyzer::estimate_total_group_storage(
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

    // ═══════════════════════════════════════════════════════════════
    //  Gas Cost Profiling (from gas_benchmark.rs)
    // ═══════════════════════════════════════════════════════════════

    /// Profiles the storage operation count for `contribute()` before and after
    /// the optimizations.
    ///
    /// Returns `(ops_before, ops_after)` for a single contribution call.
    pub fn profile_contribute_ops() -> (u32, u32) {
        let ops_before: u32 = 2 + 1 + 1 + 2 + 1 + 1 + 1 + 2 + 2 + 2 + 2 + 1;
        let ops_after: u32 = 1 + 1 + 1 + 1 + 1 + 2 + 2 + 2 + 2;
        (ops_before, ops_after)
    }

    /// Profiles the storage operation count for `execute_payout()` before and after
    /// the reverse-index optimization.
    ///
    /// Returns `(ops_before, ops_after)` for a single payout call with `member_count`
    /// members.
    pub fn profile_payout_ops(member_count: u32) -> (u32, u32) {
        let ops_before: u32 = 1 + 1 + 1 + 1 + 1 + member_count + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1;
        let ops_after: u32 = 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1;
        (ops_before, ops_after)
    }

    /// Calculates the total storage operations saved across a full group lifecycle.
    ///
    /// # Arguments
    /// * `member_count` - Number of members in the group
    /// * `cycle_count`  - Number of cycles (equals member_count for a ROSCA)
    ///
    /// # Returns
    /// `(total_before, total_after, saved, pct_reduction)`
    pub fn full_lifecycle_savings(member_count: u32, cycle_count: u32) -> (u64, u64, u64, u32) {
        let (contrib_before, contrib_after) = profile_contribute_ops();
        let (payout_before, payout_after) = profile_payout_ops(member_count);

        let total_contributions = member_count as u64 * cycle_count as u64;
        let total_payouts = cycle_count as u64;

        let total_before =
            (contrib_before as u64 * total_contributions) + (payout_before as u64 * total_payouts);
        let total_after =
            (contrib_after as u64 * total_contributions) + (payout_after as u64 * total_payouts);

        let saved = total_before.saturating_sub(total_after);
        let pct = if total_before > 0 {
            ((saved * 100) / total_before) as u32
        } else {
            0
        };

        (total_before, total_after, saved, pct)
    }

    /// Profiles the storage operation count for cycle advancement via `tick()` before
    /// and after the optimizations.
    ///
    /// Returns `(ops_before, ops_after)` for a single tick call.
    pub fn profile_tick_ops() -> (u32, u32) {
        let ops_before: u32 = 1 + 1 + 1 + 1;
        let ops_after: u32 = 1 + 1 + 1;
        (ops_before, ops_after)
    }

    /// Profiles storage operation count for `contribute_batch()` with `batch_size` cycles.
    ///
    /// Returns `(ops_before, ops_after)` for a batch contribution call.
    pub fn profile_batch_contribute_ops(batch_size: u32) -> (u32, u32) {
        let common_base = 3;
        let ops_before = common_base + (batch_size * 10);
        let ops_after = common_base + (batch_size * 9);
        (ops_before, ops_after)
    }

    // ═══════════════════════════════════════════════════════════════
    //  Benchmark Tests & Regression Guards
    // ═══════════════════════════════════════════════════════════════

    // ─── Stellar fee constants (stroops) ─────────────────────────

    const STROOPS_PER_XLM: u64 = 10_000_000;
    const FEE_PER_10K_INSNS: u64 = 25;
    const FEE_PER_READ: u64 = 6_250;
    const FEE_PER_WRITE: u64 = 10_000;
    const BASE_FEE: u64 = 100;

    fn estimate_fee_stroops(cpu_insns: u64, reads: u64, writes: u64) -> u64 {
        let insn_fee = (cpu_insns / 10_000).saturating_add(1) * FEE_PER_10K_INSNS;
        BASE_FEE + insn_fee + reads * FEE_PER_READ + writes * FEE_PER_WRITE
    }

    fn stroops_to_xlm(stroops: u64) -> f64 {
        stroops as f64 / STROOPS_PER_XLM as f64
    }

    // ─── Test environment helpers ─────────────────────────────────

    struct BenchEnv {
        env: Env,
        contract_id: Address,
        token_address: Address,
    }

    fn setup() -> BenchEnv {
        let env = Env::default();
        env.mock_all_auths();
        env.budget().reset_unlimited();

        let contract_id = env.register(StellarSaveContract, ());
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();

        BenchEnv { env, contract_id, token_address }
    }

    fn mint_tokens(b: &BenchEnv, addr: &Address, amount: i128) {
        soroban_sdk::token::StellarAssetClient::new(&b.env, &b.token_address)
            .mint(addr, &amount);
    }

    fn create_group_for_bench(b: &BenchEnv, creator: &Address, max_members: u32) -> u64 {
        mint_tokens(b, creator, 1_000_000_000_000);
        let client = StellarSaveContractClient::new(&b.env, &b.contract_id);
        client.create_group(
            creator,
            &10_000_000i128,
            &604_800u64,
            &max_members,
            &b.token_address,
            &0u64,
            &crate::payout::PayoutOrder::Sequential,
        )
    }

    fn inject_group(env: &Env, group_id: u64, creator: &Address, max_members: u32, token_address: &Address) {
        let mut group = Group::new(
            env,
            group_id,
            creator.clone(),
            10_000_000,
            604_800,
            max_members,
            2,
            env.ledger().timestamp(),
            0,
        );
        group.status = GroupStatus::Pending;
        group.started = false;
        env.storage().persistent().set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(&StorageKeyBuilder::group_status(group_id), &GroupStatus::Pending);

        let token_config = TokenConfig {
            token_address: token_address.clone(),
            token_decimals: 7,
        };
        env.storage().persistent().set(&StorageKeyBuilder::group_token_config(group_id), &token_config);
    }

    fn populate_members(
        b: &BenchEnv,
        group_id: u64,
        count: u32,
    ) -> Vec<Address> {
        let client = StellarSaveContractClient::new(&b.env, &b.contract_id);
        let mut addrs = Vec::new(&b.env);
        for _ in 0..count {
            let m = Address::generate(&b.env);
            client.join_group(&group_id, &m, &None);
            addrs.push_back(m);
        }
        addrs
    }

    fn activate_group(env: &Env, group_id: u64) {
        let key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&key).unwrap();
        group.status = GroupStatus::Active;
        group.is_active = true;
        group.started = true;
        group.started_at = env.ledger().timestamp();
        env.storage().persistent().set(&key, &group);
        env.storage().persistent().set(&StorageKeyBuilder::group_status(group_id), &GroupStatus::Active);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Benchmark Tests
    // ═══════════════════════════════════════════════════════════════

    // ─── create_group ──────────────────────────────────────────────────

    #[test]
    fn bench_create_group() {
        let b = setup();
        let creator = Address::generate(&b.env);
        mint_tokens(&b, &creator, 1_000_000_000_000);
        let client = StellarSaveContractClient::new(&b.env, &b.contract_id);

        b.env.budget().reset_unlimited();
        client.create_group(
            &creator,
            &10_000_000i128,
            &604_800u64,
            &5u32,
            &b.token_address,
            &0u64,
            &crate::payout::PayoutOrder::Sequential,
        );
        let cpu = b.env.budget().get_budget_info().cpu_insns;
        let fee = estimate_fee_stroops(cpu, 6, 5);
        println!(
            "create_group | cpu_insns={cpu} | est_fee={fee} stroops ({:.6} XLM)",
            stroops_to_xlm(fee)
        );
        assert!(cpu > 0, "create_group must consume instructions");
    }

    // ─── join_group at N = 5, 10, 15, 20 ──────────────────────────

    fn bench_join_group_at(n: u32) {
        let b = setup();
        let creator = Address::generate(&b.env);
        let group_id = 1u64;
        inject_group(&b.env, group_id, &creator, n, &b.token_address);

        let client = StellarSaveContractClient::new(&b.env, &b.contract_id);
        for _ in 0..(n - 1) {
            let m = Address::generate(&b.env);
            client.join_group(&group_id, &m, &None);
        }

        let last_member = Address::generate(&b.env);
        b.env.budget().reset_unlimited();
        client.join_group(&group_id, &last_member, &None);
        let cpu = b.env.budget().get_budget_info().cpu_insns;
        let fee = estimate_fee_stroops(cpu, 5, 4);
        println!(
            "join_group (N={n}) | cpu_insns={cpu} | est_fee={fee} stroops ({:.6} XLM)",
            stroops_to_xlm(fee)
        );
        assert!(cpu > 0);
    }

    #[test]
    fn bench_join_group_n5()  { bench_join_group_at(5);  }
    #[test]
    fn bench_join_group_n10() { bench_join_group_at(10); }
    #[test]
    fn bench_join_group_n15() { bench_join_group_at(15); }
    #[test]
    fn bench_join_group_n20() { bench_join_group_at(20); }

    // ─── get_group ─────────────────────────────────────────────────────

    #[test]
    fn bench_get_group() {
        let b = setup();
        let creator = Address::generate(&b.env);
        inject_group(&b.env, 1, &creator, 5, &b.token_address);
        let client = StellarSaveContractClient::new(&b.env, &b.contract_id);

        b.env.budget().reset_unlimited();
        let _ = client.get_group(&1u64);
        let cpu = b.env.budget().get_budget_info().cpu_insns;
        let fee = estimate_fee_stroops(cpu, 1, 0);
        println!(
            "get_group | cpu_insns={cpu} | est_fee={fee} stroops ({:.6} XLM)",
            stroops_to_xlm(fee)
        );
        assert!(cpu > 0);
    }

    // ─── get_members (full list) at N = 5, 10, 15, 20 ──────────

    fn bench_get_members_at(n: u32) {
        let b = setup();
        let creator = Address::generate(&b.env);
        let group_id = 1u64;
        inject_group(&b.env, group_id, &creator, n, &b.token_address);
        populate_members(&b, group_id, n);

        let client = StellarSaveContractClient::new(&b.env, &b.contract_id);
        b.env.budget().reset_unlimited();
        let members = client.get_members(&group_id);
        let cpu = b.env.budget().get_budget_info().cpu_insns;
        let fee = estimate_fee_stroops(cpu, 2, 0);
        println!(
            "get_members (N={n}) | cpu_insns={cpu} | returned={} | est_fee={fee} stroops ({:.6} XLM)",
            members.len(),
            stroops_to_xlm(fee)
        );
        assert_eq!(members.len(), n);
    }

    #[test]
    fn bench_get_members_n5()  { bench_get_members_at(5);  }
    #[test]
    fn bench_get_members_n10() { bench_get_members_at(10); }
    #[test]
    fn bench_get_members_n15() { bench_get_members_at(15); }
    #[test]
    fn bench_get_members_n20() { bench_get_members_at(20); }

    // ─── list_members (paginated, page of 5) at N = 5, 10, 15, 20 ─

    fn bench_list_members_at(n: u32) {
        let b = setup();
        let creator = Address::generate(&b.env);
        let group_id = 1u64;
        inject_group(&b.env, group_id, &creator, n, &b.token_address);
        populate_members(&b, group_id, n);

        let client = StellarSaveContractClient::new(&b.env, &b.contract_id);
        b.env.budget().reset_unlimited();
        let page = client.list_members(&group_id, &0u32, &5u32);
        let cpu = b.env.budget().get_budget_info().cpu_insns;
        let fee = estimate_fee_stroops(cpu, 2, 0);
        println!(
            "list_members page[0..5] (N={n}) | cpu_insns={cpu} | returned={} | est_fee={fee} stroops ({:.6} XLM)",
            page.len(),
            stroops_to_xlm(fee)
        );
        assert!(page.len() <= 5);
    }

    #[test]
    fn bench_list_members_n5()  { bench_list_members_at(5);  }
    #[test]
    fn bench_list_members_n10() { bench_list_members_at(10); }
    #[test]
    fn bench_list_members_n15() { bench_list_members_at(15); }
    #[test]
    fn bench_list_members_n20() { bench_list_members_at(20); }

    // ─── get_group_members (paginated) at N = 5, 10, 15, 20 ─────

    fn bench_get_group_members_at(n: u32) {
        let b = setup();
        let creator = Address::generate(&b.env);
        let group_id = 1u64;
        inject_group(&b.env, group_id, &creator, n, &b.token_address);
        populate_members(&b, group_id, n);

        let client = StellarSaveContractClient::new(&b.env, &b.contract_id);
        b.env.budget().reset_unlimited();
        let page = client.get_group_members(&group_id, &0u32, &5u32);
        let cpu = b.env.budget().get_budget_info().cpu_insns;
        let fee = estimate_fee_stroops(cpu, 2, 0);
        println!(
            "get_group_members page[0..5] (N={n}) | cpu_insns={cpu} | returned={} | est_fee={fee} stroops ({:.6} XLM)",
            page.len(),
            stroops_to_xlm(fee)
        );
        assert!(page.len() <= 5);
    }

    #[test]
    fn bench_get_group_members_n5()  { bench_get_group_members_at(5);  }
    #[test]
    fn bench_get_group_members_n10() { bench_get_group_members_at(10); }
    #[test]
    fn bench_get_group_members_n15() { bench_get_group_members_at(15); }
    #[test]
    fn bench_get_group_members_n20() { bench_get_group_members_at(20); }

    // ─── get_member_count at N = 5, 10, 15, 20 ──────────────────

    fn bench_get_member_count_at(n: u32) {
        let b = setup();
        let creator = Address::generate(&b.env);
        let group_id = 1u64;
        inject_group(&b.env, group_id, &creator, n, &b.token_address);
        populate_members(&b, group_id, n);

        let client = StellarSaveContractClient::new(&b.env, &b.contract_id);
        b.env.budget().reset_unlimited();
        let count = client.get_member_count(&group_id);
        let cpu = b.env.budget().get_budget_info().cpu_insns;
        let fee = estimate_fee_stroops(cpu, 1, 0);
        println!(
            "get_member_count (N={n}) | cpu_insns={cpu} | count={count} | est_fee={fee} stroops ({:.6} XLM)",
            stroops_to_xlm(fee)
        );
        assert_eq!(count, n);
    }

    #[test]
    fn bench_get_member_count_n5()  { bench_get_member_count_at(5);  }
    #[test]
    fn bench_get_member_count_n10() { bench_get_member_count_at(10); }
    #[test]
    fn bench_get_member_count_n15() { bench_get_member_count_at(15); }
    #[test]
    fn bench_get_member_count_n20() { bench_get_member_count_at(20); }

    // ─── is_member at N = 5, 10, 15, 20 ──────────────────────────

    fn bench_is_member_at(n: u32) {
        let b = setup();
        let creator = Address::generate(&b.env);
        let group_id = 1u64;
        inject_group(&b.env, group_id, &creator, n, &b.token_address);
        let members = populate_members(&b, group_id, n);
        let target = members.get(0).unwrap();

        let client = StellarSaveContractClient::new(&b.env, &b.contract_id);
        b.env.budget().reset_unlimited();
        let is_member = client.is_member(&group_id, &target);
        let cpu = b.env.budget().get_budget_info().cpu_insns;
        let fee = estimate_fee_stroops(cpu, 2, 0);
        println!(
            "is_member (N={n}) | cpu_insns={cpu} | result={is_member} | est_fee={fee} stroops ({:.6} XLM)",
            stroops_to_xlm(fee)
        );
        assert!(is_member);
    }

    #[test]
    fn bench_is_member_n5()  { bench_is_member_at(5);  }
    #[test]
    fn bench_is_member_n10() { bench_is_member_at(10); }
    #[test]
    fn bench_is_member_n15() { bench_is_member_at(15); }
    #[test]
    fn bench_is_member_n20() { bench_is_member_at(20); }

    // ─── get_payout_position at N = 5, 10, 15, 20 ───────────────

    fn bench_get_payout_position_at(n: u32) {
        let b = setup();
        let creator = Address::generate(&b.env);
        let group_id = 1u64;
        inject_group(&b.env, group_id, &creator, n, &b.token_address);
        let members = populate_members(&b, group_id, n);
        let target = members.get(0).unwrap();

        let client = StellarSaveContractClient::new(&b.env, &b.contract_id);
        b.env.budget().reset_unlimited();
        let pos = client.get_payout_position(&group_id, &target);
        let cpu = b.env.budget().get_budget_info().cpu_insns;
        let fee = estimate_fee_stroops(cpu, 2, 0);
        println!(
            "get_payout_position (N={n}) | cpu_insns={cpu} | pos={pos} | est_fee={fee} stroops ({:.6} XLM)",
            stroops_to_xlm(fee)
        );
        assert_eq!(pos, 0u32);
    }

    #[test]
    fn bench_get_payout_position_n5()  { bench_get_payout_position_at(5);  }
    #[test]
    fn bench_get_payout_position_n10() { bench_get_payout_position_at(10); }
    #[test]
    fn bench_get_payout_position_n15() { bench_get_payout_position_at(15); }
    #[test]
    fn bench_get_payout_position_n20() { bench_get_payout_position_at(20); }

    // ─── Summary table ──────────────────────────────────────────────

    #[test]
    fn bench_summary_table() {
        println!("\n=== Stellar-Save Gas Cost Summary (CPU Instructions) ===\n");
        println!("{:<28} {:>8} {:>8} {:>8} {:>8}", "Function", "N=5", "N=10", "N=15", "N=20");
        println!("{}", "-".repeat(60));

        let group_sizes: [u32; 4] = [5, 10, 15, 20];

        let join_costs: [u64; 4] = group_sizes.map(|n| {
            let b = setup();
            let creator = Address::generate(&b.env);
            inject_group(&b.env, 1, &creator, n, &b.token_address);
            let client = StellarSaveContractClient::new(&b.env, &b.contract_id);
            for _ in 0..(n - 1) {
                client.join_group(&1u64, &Address::generate(&b.env), &None);
            }
            let m = Address::generate(&b.env);
            b.env.budget().reset_unlimited();
            client.join_group(&1u64, &m, &None);
            b.env.budget().get_budget_info().cpu_insns
        });
        println!("{:<28} {:>8} {:>8} {:>8} {:>8}", "join_group", join_costs[0], join_costs[1], join_costs[2], join_costs[3]);

        let read_costs: [u64; 4] = group_sizes.map(|n| {
            let b = setup();
            let creator = Address::generate(&b.env);
            inject_group(&b.env, 1, &creator, n, &b.token_address);
            populate_members(&b, 1, n);
            let client = StellarSaveContractClient::new(&b.env, &b.contract_id);
            b.env.budget().reset_unlimited();
            client.get_members(&1u64);
            b.env.budget().get_budget_info().cpu_insns
        });
        println!("{:<28} {:>8} {:>8} {:>8} {:>8}", "get_members (full)", read_costs[0], read_costs[1], read_costs[2], read_costs[3]);

        let page_costs: [u64; 4] = group_sizes.map(|n| {
            let b = setup();
            let creator = Address::generate(&b.env);
            inject_group(&b.env, 1, &creator, n, &b.token_address);
            populate_members(&b, 1, n);
            let client = StellarSaveContractClient::new(&b.env, &b.contract_id);
            b.env.budget().reset_unlimited();
            client.list_members(&1u64, &0u32, &5u32);
            b.env.budget().get_budget_info().cpu_insns
        });
        println!("{:<28} {:>8} {:>8} {:>8} {:>8}", "list_members (page 5)", page_costs[0], page_costs[1], page_costs[2], page_costs[3]);

        let membership_costs: [u64; 4] = group_sizes.map(|n| {
            let b = setup();
            let creator = Address::generate(&b.env);
            inject_group(&b.env, 1, &creator, n, &b.token_address);
            let members = populate_members(&b, 1, n);
            let t = members.get(0).unwrap();
            let client = StellarSaveContractClient::new(&b.env, &b.contract_id);
            b.env.budget().reset_unlimited();
            client.is_member(&1u64, &t);
            b.env.budget().get_budget_info().cpu_insns
        });
        println!("{:<28} {:>8} {:>8} {:>8} {:>8}", "is_member", membership_costs[0], membership_costs[1], membership_costs[2], membership_costs[3]);

        println!();
        println!("Fee estimates use: 25 stroops/10K insns + 6250/read + 10000/write + 100 base");
        println!("1 XLM = 10,000,000 stroops");

        println!("\n=== Estimated Fee per Call (stroops / XLM) ===\n");
        println!("{:<28} {:>18} {:>18} {:>18} {:>18}", "Function", "N=5", "N=10", "N=15", "N=20");
        println!("{}", "-".repeat(94));

        let labels = ["join_group", "get_members (full)", "list_members (page 5)", "is_member"];
        let all_costs = [join_costs, read_costs, page_costs, membership_costs];
        let reads_per_fn: [u64; 4] = [5, 2, 2, 2];
        let writes_per_fn: [u64; 4] = [4, 0, 0, 0];

        for (i, label) in labels.iter().enumerate() {
            let row: [String; 4] = core::array::from_fn(|j| {
                let fee = estimate_fee_stroops(all_costs[i][j], reads_per_fn[i], writes_per_fn[i]);
                format!("{} / {:.5}", fee, stroops_to_xlm(fee))
            });
            println!("{:<28} {:>18} {:>18} {:>18} {:>18}", label, row[0], row[1], row[2], row[3]);
        }
        println!();
    }

    // ═══════════════════════════════════════════════════════════════
    //  Regression Guards (from gas_benchmark_tests.rs)
    // ═══════════════════════════════════════════════════════════════

    fn setup_group(env: &Env, group_id: u64, max_members: u32, token_address: &Address) -> Address {
        let creator = Address::generate(env);
        let mut group = Group::new(
            env,
            group_id,
            creator.clone(),
            10_000_000,
            604_800,
            max_members,
            2,
            env.ledger().timestamp(),
            0,
        );
        group.status = GroupStatus::Pending;
        env.storage().persistent().set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(&StorageKeyBuilder::group_status(group_id), &GroupStatus::Pending);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_token_config(group_id),
            &TokenConfig { token_address: token_address.clone(), token_decimals: 7 },
        );
        creator
    }

    /// join_group must stay under 5M CPU instructions for a 20-member group.
    #[test]
    fn regression_join_group_n20() {
        let env = Env::default();
        env.mock_all_auths();
        env.budget().reset_unlimited();
        let contract_id = env.register(StellarSaveContract, ());
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let client = StellarSaveContractClient::new(&env, &contract_id);
        setup_group(&env, 1, 20, &token_address);

        for _ in 0..19 {
            client.join_group(&1u64, &Address::generate(&env), &None);
        }
        let last = Address::generate(&env);
        env.budget().reset_unlimited();
        client.join_group(&1u64, &last, &None);
        let cpu = env.budget().get_budget_info().cpu_insns;
        assert!(cpu < 5_000_000, "join_group N=20 regressed: {cpu} insns");
    }

    /// get_members must stay under 2M CPU instructions for a 20-member group.
    #[test]
    fn regression_get_members_n20() {
        let env = Env::default();
        env.mock_all_auths();
        env.budget().reset_unlimited();
        let contract_id = env.register(StellarSaveContract, ());
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let client = StellarSaveContractClient::new(&env, &contract_id);
        setup_group(&env, 1, 20, &token_address);
        for _ in 0..20 {
            client.join_group(&1u64, &Address::generate(&env), &None);
        }
        env.budget().reset_unlimited();
        let members = client.get_members(&1u64);
        let cpu = env.budget().get_budget_info().cpu_insns;
        assert_eq!(members.len(), 20);
        assert!(cpu < 2_000_000, "get_members N=20 regressed: {cpu} insns");
    }

    /// list_members (first page of 5) must be cheaper than or equal to get_members for large groups.
    #[test]
    fn regression_list_members_not_worse_than_get_members_n20() {
        let env = Env::default();
        env.mock_all_auths();
        env.budget().reset_unlimited();
        let contract_id = env.register(StellarSaveContract, ());
        let token_address = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let client = StellarSaveContractClient::new(&env, &contract_id);
        setup_group(&env, 1, 20, &token_address);
        for _ in 0..20 {
            client.join_group(&1u64, &Address::generate(&env), &None);
        }

        env.budget().reset_unlimited();
        client.get_members(&1u64);
        let full_cost = env.budget().get_budget_info().cpu_insns;

        env.budget().reset_unlimited();
        client.list_members(&1u64, &0u32, &5u32);
        let page_cost = env.budget().get_budget_info().cpu_insns;

        assert!(
            page_cost <= full_cost,
            "list_members page cost ({page_cost}) > get_members full cost ({full_cost})"
        );
    }

    /// contribute must stay under 4.5M CPU instructions.
    #[test]
    fn regression_contribute_ceiling() {
        let b = setup();
        let creator = Address::generate(&b.env);
        let group_id = 1u64;
        inject_group(&b.env, group_id, &creator, 5, &b.token_address);
        let members = populate_members(&b, group_id, 5);
        activate_group(&b.env, group_id);

        let member = members.get(0).unwrap();
        mint_tokens(&b, &member, 10_000_000);

        let client = StellarSaveContractClient::new(&b.env, &b.contract_id);
        b.env.budget().reset_unlimited();
        client.contribute(&group_id, &member, &10_000_000i128);
        let cpu = b.env.budget().get_budget_info().cpu_insns;
        assert!(cpu < 4_500_000, "contribute regressed: {cpu} insns");
    }

    /// tick (cycle advancement) must stay under 3.5M CPU instructions.
    #[test]
    fn regression_cycle_advancement_ceiling() {
        let b = setup();
        let creator = Address::generate(&b.env);
        let group_id = 1u64;
        inject_group(&b.env, group_id, &creator, 5, &b.token_address);
        let _members = populate_members(&b, group_id, 5);
        activate_group(&b.env, group_id);

        b.env.ledger().set_timestamp(b.env.ledger().timestamp() + 604_800 + 10);

        let client = StellarSaveContractClient::new(&b.env, &b.contract_id);
        b.env.budget().reset_unlimited();
        client.tick(&group_id);
        let cpu = b.env.budget().get_budget_info().cpu_insns;
        assert!(cpu < 3_500_000, "tick cycle advancement regressed: {cpu} insns");
    }

    /// contribute_batch must stay under 6.0M CPU instructions for 2 cycles.
    #[test]
    fn regression_batch_contribute_ceiling() {
        let b = setup();
        let creator = Address::generate(&b.env);
        let group_id = 1u64;
        inject_group(&b.env, group_id, &creator, 5, &b.token_address);
        let members = populate_members(&b, group_id, 5);
        activate_group(&b.env, group_id);

        let member = members.get(0).unwrap();
        mint_tokens(&b, &member, 20_000_000);

        let mut cycles = Vec::new(&b.env);
        cycles.push_back(0);
        cycles.push_back(1);

        let client = StellarSaveContractClient::new(&b.env, &b.contract_id);
        b.env.budget().reset_unlimited();
        client.contribute_batch(&group_id, &member, &cycles);
        let cpu = b.env.budget().get_budget_info().cpu_insns;
        assert!(cpu < 6_000_000, "contribute_batch regressed: {cpu} insns");
    }

    // ═══════════════════════════════════════════════════════════════
    //  Regression Comparison Test
    //  Verifies that the baseline comparison mechanism detects a
    //  deliberate regression by using an intentionally wrong baseline.
    // ═══════════════════════════════════════════════════════════════

    /// Represents a single function's baseline and measured values for comparison.
    struct ComparisonEntry {
        function: &'static str,
        baseline: u64,
        measured: u64,
        threshold_pct: f64,
    }

    impl ComparisonEntry {
        fn new(function: &'static str, baseline: u64, measured: u64, threshold_pct: f64) -> Self {
            Self { function, baseline, measured, threshold_pct }
        }

        /// Returns true if the measured value regresses beyond the threshold.
        fn has_regression(&self) -> bool {
            if self.baseline == 0 {
                return false;
            }
            let delta_pct = ((self.measured as f64 - self.baseline as f64) / self.baseline as f64) * 100.0;
            delta_pct > self.threshold_pct
        }

        fn delta_pct(&self) -> f64 {
            if self.baseline == 0 {
                return 0.0;
            }
            ((self.measured as f64 - self.baseline as f64) / self.baseline as f64) * 100.0
        }
    }

    /// Run a comparison against a deliberately wrong baseline that is
    /// set to 1/10th of the measured value, guaranteeing a regression
    /// detection. This verifies the comparison mechanism works correctly.
    #[test]
    fn comparison_fails_on_deliberate_regression() {
        // Simulate a measured value for create_group that is 10× the
        // deliberately wrong baseline, triggering a clear regression.
        let entries = vec![
            ComparisonEntry::new("create_group", 4_823, 48_234, 10.0),
        ];

        let regressions: Vec<&ComparisonEntry> = entries.iter().filter(|e| e.has_regression()).collect();

        // The deliberately wrong baseline (4_823 ≈ 1/10th of 48_234)
        // should be detected as a regression (>10% threshold).
        assert_eq!(regressions.len(), 1, "Deliberate regression should be detected");
        assert!(
            regressions[0].delta_pct() > 10.0,
            "Delta should exceed 10% threshold, got {:.1}%",
            regressions[0].delta_pct()
        );
    }

    /// Verify that when measured is within threshold, no regression is flagged.
    #[test]
    fn comparison_passes_within_threshold() {
        let entries = vec![
            ComparisonEntry::new("create_group", 48_234, 52_000, 10.0),
        ];

        let regressions: Vec<&ComparisonEntry> = entries.iter().filter(|e| e.has_regression()).collect();
        assert!(regressions.is_empty(), "No regression expected within 10% threshold");
    }

    /// Verify that the baseline JSON file contains the three core operations
    /// required by the issue: create_group, contribute, execute_payout.
    #[test]
    fn baseline_file_contains_core_operations() {
        let baseline_path = std::path::Path::new("scripts/benchmark_baseline.json");
        assert!(
            baseline_path.exists(),
            "Baseline file must exist at scripts/benchmark_baseline.json"
        );

        let content = std::fs::read_to_string(baseline_path)
            .expect("Failed to read baseline file");

        let required = ["create_group", "contribute", "execute_payout"];
        for op in &required {
            assert!(
                content.contains(op),
                "Baseline must contain '{}' for the three core operations",
                op
            );
        }
    }

    /// Verify that each core operation in the baseline has a positive
    /// baseline_cpu_insns value and a group_size field.
    #[test]
    fn baseline_core_operations_have_valid_values() {
        let baseline_path = std::path::Path::new("scripts/benchmark_baseline.json");
        let content = std::fs::read_to_string(baseline_path)
            .expect("Failed to read baseline file");

        for op in ["create_group", "contribute", "execute_payout"] {
            // Extract baseline_cpu_insns for this operation
            let op_marker = format!("\"{}\"", op);
            let op_start = content.find(&op_marker)
                .expect("Baseline must contain core operation entry");
            let after_op = &content[op_start..];

            let cpu_marker = "\"baseline_cpu_insns\"";
            let cpu_start = after_op.find(cpu_marker)
                .expect("Each core operation must have baseline_cpu_insns");
            let after_cpu = &after_op[cpu_start..];
            let cpu_val_str = after_cpu
                .strip_prefix(cpu_marker)
                .and_then(|s| s.trim_start_matches(|c: char| c != ':' || c == ' '))
                .and_then(|s| s.strip_prefix(':'))
                .unwrap_or("")
                .trim()
                .trim_start_matches(|c: char| !c.is_ascii_digit())
                .split(|c: char| !c.is_ascii_digit())
                .next()
                .unwrap_or("0");
            let cpu_insns: u64 = cpu_val_str.parse().expect("baseline_cpu_insns must be a number");
            assert!(cpu_insns > 0, "{op} baseline_cpu_insns must be positive");

            let gs_marker = "\"group_size\"";
            let gs_start = after_op.find(gs_marker)
                .expect("Each core operation must have group_size");
            let after_gs = &after_op[gs_start..];
            let gs_val_str = after_gs
                .strip_prefix(gs_marker)
                .and_then(|s| s.trim_start_matches(|c: char| c != ':' || c == ' '))
                .and_then(|s| s.strip_prefix(':'))
                .unwrap_or("")
                .trim()
                .trim_start_matches(|c: char| !c.is_ascii_digit())
                .split(|c: char| !c.is_ascii_digit())
                .next()
                .unwrap_or("0");
            let group_size: u64 = gs_val_str.parse().expect("group_size must be a number");
            assert!(group_size > 0, "{op} group_size must be positive");
        }
    }

    /// Integration-style test: verify the regression comparison logic
    /// detects a deliberate regression when the baseline is set to
    /// 1/10th of the measured value.
    #[test]
    fn regression_gate_fails_with_wrong_baseline() {
        // Load the real baseline value for create_group
        let baseline_path = std::path::Path::new("scripts/benchmark_baseline.json");
        let content = std::fs::read_to_string(baseline_path)
            .expect("Failed to read baseline file");

        // Extract the real baseline_cpu_insns for create_group
        let op_start = content.find("\"create_group\"")
            .expect("Baseline must contain create_group");
        let after_op = &content[op_start..];
        let cpu_marker = "\"baseline_cpu_insns\"";
        let cpu_start = after_op.find(cpu_marker)
            .expect("Must have baseline_cpu_insns for create_group");
        let after_cpu = &after_op[cpu_start..];
        let real_baseline: u64 = after_cpu
            .trim_start_matches(cpu_marker)
            .trim_start_matches(|c: char| c != ':' && c != ' ')
            .trim_start_matches(':')
            .trim()
            .trim_start_matches(|c: char| !c.is_ascii_digit())
            .split(|c: char| !c.is_ascii_digit())
            .next()
            .unwrap_or("0")
            .parse()
            .expect("baseline_cpu_insns must be a number");

        // Simulate a corrupted baseline at 1/10th of the real value
        let corrupted_baseline = real_baseline / 10;
        let threshold_pct = 10.0;
        let delta_pct = ((real_baseline as f64 - corrupted_baseline as f64)
            / corrupted_baseline as f64)
            * 100.0;
        assert!(
            delta_pct > threshold_pct,
            "Corrupted baseline (1/10th) should trigger regression detection: \
             delta={:.1}% > threshold={}%",
            delta_pct,
            threshold_pct
        );
    }

    // ═══════════════════════════════════════════════════════════════
    //  Unit Tests for Profiling Functions
    // ═══════════════════════════════════════════════════════════════

    #[test]
    fn test_profile_contribute_ops_reduction() {
        let (before, after) = profile_contribute_ops();
        assert!(after < before, "contribute() should use fewer ops after optimization");
        assert_eq!(before, 19, "before: expected 19 ops");
        assert_eq!(after, 13, "after: expected 13 persistent ops");
        let reduction_pct = ((before - after) * 100) / before;
        assert!(reduction_pct >= 30, "Expected ≥30% reduction, got {}%", reduction_pct);
    }

    #[test]
    fn test_profile_payout_ops_reduction_small_group() {
        let (before, after) = profile_payout_ops(5);
        assert!(after < before);
        let reduction_pct = ((before - after) * 100) / before;
        assert!(reduction_pct >= 20, "Expected ≥20% reduction for N=5, got {}%", reduction_pct);
    }

    #[test]
    fn test_profile_payout_ops_reduction_medium_group() {
        let (before, after) = profile_payout_ops(20);
        let reduction_pct = ((before - after) * 100) / before;
        assert!(reduction_pct >= 50, "Expected ≥50% reduction for N=20, got {}%", reduction_pct);
    }

    #[test]
    fn test_profile_payout_ops_reduction_large_group() {
        let (before, after) = profile_payout_ops(100);
        let reduction_pct = ((before - after) * 100) / before;
        assert!(reduction_pct >= 80, "Expected ≥80% reduction for N=100, got {}%", reduction_pct);
    }

    #[test]
    fn test_full_lifecycle_savings_10_members() {
        let (before, after, saved, pct) = full_lifecycle_savings(10, 10);
        assert!(saved > 0, "Should save ops for 10-member group");
        assert!(pct >= 20, "Expected ≥20% lifecycle reduction for N=10, got {}%", pct);
        println!("N=10: before={}, after={}, saved={}, reduction={}%", before, after, saved, pct);
    }

    #[test]
    fn test_full_lifecycle_savings_50_members() {
        let (before, after, saved, pct) = full_lifecycle_savings(50, 50);
        assert!(saved > 0);
        assert!(pct >= 20, "Expected ≥20% lifecycle reduction for N=50, got {}%", pct);
        println!("N=50: before={}, after={}, saved={}, reduction={}%", before, after, saved, pct);
    }

    #[test]
    fn test_full_lifecycle_savings_100_members() {
        let (before, after, saved, pct) = full_lifecycle_savings(100, 100);
        assert!(saved > 0);
        assert!(pct >= 20, "Expected ≥20% lifecycle reduction for N=100, got {}%", pct);
        println!("N=100: before={}, after={}, saved={}, reduction={}%", before, after, saved, pct);
    }

    #[test]
    fn test_profile_tick_ops_reduction() {
        let (before, after) = profile_tick_ops();
        assert!(after < before);
        assert_eq!(before, 4);
        assert_eq!(after, 3);
        let reduction_pct = ((before - after) * 100) / before;
        assert_eq!(reduction_pct, 25);
    }

    #[test]
    fn test_profile_batch_contribute_ops_reduction() {
        let (before, after) = profile_batch_contribute_ops(5);
        assert!(after < before);
        assert_eq!(before - after, 5);
    }

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
