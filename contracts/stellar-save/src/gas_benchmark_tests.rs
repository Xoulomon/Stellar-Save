//! Gas Cost Benchmark Tests
//!
//! Measures CPU instruction counts for all public contract functions at group
//! sizes of 5, 10, 15, and 20 members using Soroban's built-in budget tracker.
//!
//! ## Methodology
//!
//! Each benchmark resets the budget tracker to zero before the measured call,
//! then reads `env.budget().get_budget_info().cpu_insns` immediately after.
//! Only the target call is measured; setup work runs with an unlimited budget
//! before the measurement window.
//!
//! ## Fee Estimation
//!
//! Stellar Soroban fee formula (Testnet/Mainnet approximation):
//!   - Instruction fee:  25 stroops per 10,000 instructions
//!   - Ledger read fee:  6,250 stroops per entry
//!   - Ledger write fee: 10,000 stroops per entry
//!   - Base inclusion:   100 stroops
//!   - 1 XLM = 10,000,000 stroops
//!
//! The helpers in this module compute a rough total from measured instruction
//! counts and the operation counts documented in `gas_benchmark.rs`.

#[cfg(test)]
mod benchmarks {
    use soroban_sdk::{
        testutils::Address as _,
        Address, Env, Map, Vec,
    };

    use crate::{
        group::{Group, GroupStatus, TokenConfig},
        storage::StorageKeyBuilder,
        Group as _,
        MemberProfile,
        StellarSaveContract,
        StellarSaveContractClient,
    };

    // ─── Stellar fee constants (stroops) ─────────────────────────────────────

    const STROOPS_PER_XLM: u64 = 10_000_000;
    /// Instruction fee: 25 stroops per 10,000-instruction increment.
    const FEE_PER_10K_INSNS: u64 = 25;
    /// Approximate ledger-read fee per persistent entry.
    const FEE_PER_READ: u64 = 6_250;
    /// Approximate ledger-write fee per persistent entry.
    const FEE_PER_WRITE: u64 = 10_000;
    /// Base inclusion fee.
    const BASE_FEE: u64 = 100;

    /// Converts a CPU instruction count + storage op counts to an estimated
    /// fee in stroops.
    fn estimate_fee_stroops(cpu_insns: u64, reads: u64, writes: u64) -> u64 {
        let insn_fee = (cpu_insns / 10_000).saturating_add(1) * FEE_PER_10K_INSNS;
        BASE_FEE + insn_fee + reads * FEE_PER_READ + writes * FEE_PER_WRITE
    }

    fn stroops_to_xlm(stroops: u64) -> f64 {
        stroops as f64 / STROOPS_PER_XLM as f64
    }

    // ─── Test environment helpers ─────────────────────────────────────────────

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

    /// Registers a Stellar Asset Contract and mints tokens to `addr`.
    fn mint_tokens(b: &BenchEnv, addr: &Address, amount: i128) {
        soroban_sdk::token::StellarAssetClient::new(&b.env, &b.token_address)
            .mint(addr, &amount);
    }

    /// Creates a group via the contract client and returns its ID.
    fn create_group_for_bench(b: &BenchEnv, creator: &Address, max_members: u32) -> u64 {
        mint_tokens(b, creator, 1_000_000_000_000);
        let client = StellarSaveContractClient::new(&b.env, &b.contract_id);
        client.create_group(
            creator,
            &10_000_000i128,  // 1 XLM contribution
            &604_800u64,       // 1-week cycle
            &max_members,
            &b.token_address,
            &0u64,
            &crate::payout::PayoutOrder::Sequential,
        )
    }

    /// Directly inserts a fully-configured group into storage (no token call).
    /// Used by benchmarks that measure functions other than `create_group`.
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
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_status(group_id), &GroupStatus::Pending);

        let token_config = TokenConfig {
            token_address: token_address.clone(),
            token_decimals: 7,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_token_config(group_id), &token_config);
    }

    /// Adds `count` members to a group through `join_group`, returning their addresses.
    fn populate_members(
        b: &BenchEnv,
        group_id: u64,
        count: u32,
    ) -> soroban_sdk::Vec<Address> {
        let client = StellarSaveContractClient::new(&b.env, &b.contract_id);
        let mut addrs = soroban_sdk::Vec::new(&b.env);
        for _ in 0..count {
            let m = Address::generate(&b.env);
            client.join_group(&group_id, &m, &None);
            addrs.push_back(m);
        }
        addrs
    }

    /// Activates a group so contributions can be accepted.
    fn activate_group(env: &Env, group_id: u64) {
        let key = StorageKeyBuilder::group_data(group_id);
        let mut group: Group = env.storage().persistent().get(&key).unwrap();
        group.status = GroupStatus::Active;
        group.is_active = true;
        group.started = true;
        group.started_at = env.ledger().timestamp();
        env.storage().persistent().set(&key, &group);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_status(group_id), &GroupStatus::Active);
    }

    // ─── Benchmark: create_group ──────────────────────────────────────────────

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
        // create_group: ~6 reads (config, counter, group_data, status, token_config, allowed_tokens)
        //               + ~5 writes (group_data, status, token_config, counter, group_id_counter)
        let fee = estimate_fee_stroops(cpu, 6, 5);
        println!(
            "create_group | cpu_insns={cpu} | est_fee={fee} stroops ({:.6} XLM)",
            stroops_to_xlm(fee)
        );
        assert!(cpu > 0, "create_group must consume instructions");
    }

    // ─── Benchmark: join_group at N = 5, 10, 15, 20 ──────────────────────────

    fn bench_join_group_at(n: u32) {
        let b = setup();
        let creator = Address::generate(&b.env);
        let group_id = 1u64;
        inject_group(&b.env, group_id, &creator, n, &b.token_address);

        // Pre-fill n-1 members so the Nth join is measured under load.
        let client = StellarSaveContractClient::new(&b.env, &b.contract_id);
        for _ in 0..(n - 1) {
            let m = Address::generate(&b.env);
            client.join_group(&group_id, &m, &None);
        }

        let last_member = Address::generate(&b.env);
        b.env.budget().reset_unlimited();
        client.join_group(&group_id, &last_member, &None);
        let cpu = b.env.budget().get_budget_info().cpu_insns;
        // join_group: ~5 reads + ~4 writes (member profile, payout eligibility, pos-index, group)
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

    // ─── Benchmark: get_group ────────────────────────────────────────────────

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

    // ─── Benchmark: get_members (full list) at N = 5, 10, 15, 20 ────────────

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
        // get_members: 1 group read + 1 members-map read
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

    // ─── Benchmark: list_members (paginated, page of 5) at N = 5, 10, 15, 20 ─

    fn bench_list_members_at(n: u32) {
        let b = setup();
        let creator = Address::generate(&b.env);
        let group_id = 1u64;
        inject_group(&b.env, group_id, &creator, n, &b.token_address);
        populate_members(&b, group_id, n);

        let client = StellarSaveContractClient::new(&b.env, &b.contract_id);
        b.env.budget().reset_unlimited();
        // Request first page of 5 members (offset=0, limit=5).
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

    // ─── Benchmark: get_group_members (paginated) at N = 5, 10, 15, 20 ──────

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

    // ─── Benchmark: get_member_count at N = 5, 10, 15, 20 ───────────────────

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

    // ─── Benchmark: is_member at N = 5, 10, 15, 20 ──────────────────────────

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

    // ─── Benchmark: get_payout_position at N = 5, 10, 15, 20 ────────────────

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

    // ─── Benchmark summary table (printed, no assertion) ─────────────────────

    #[test]
    fn bench_summary_table() {
        println!("\n=== Stellar-Save Gas Cost Summary (CPU Instructions) ===\n");
        println!("{:<28} {:>8} {:>8} {:>8} {:>8}", "Function", "N=5", "N=10", "N=15", "N=20");
        println!("{}", "-".repeat(60));

        let group_sizes: [u32; 4] = [5, 10, 15, 20];

        // join_group
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

        // get_members
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

        // list_members page[0..5]
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

        // is_member
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

        // Fee table
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
}

// ─── Performance regression guards ───────────────────────────────────────────

#[cfg(test)]
mod regression {
    use soroban_sdk::{testutils::Address as _, Address, Env};
    use crate::{
        group::{Group, GroupStatus, TokenConfig},
        storage::StorageKeyBuilder,
        StellarSaveContract,
        StellarSaveContractClient,
    };

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
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_status(group_id), &GroupStatus::Pending);
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
}
