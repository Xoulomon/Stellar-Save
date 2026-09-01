//! Performance Benchmark Tests for fungible-allowlist contract.
//!
//! Measures CPU instruction counts for all public contract functions using
//! Soroban's built-in budget tracker.
//!
//! ## Methodology
//!
//! Each benchmark:
//! 1. Sets up the required state with an unlimited budget (not measured).
//! 2. Resets the budget tracker to zero.
//! 3. Executes the target function.
//! 4. Reads `env.budget().cpu_instructions()` and prints the result.
//!
//! The printed line format is:
//!   `bench_<name>: cpu_insns = <N>`
//!
//! This format is parsed by `scripts/benchmark_regression.sh`.
//!
//! ## Updating baselines
//!
//! Run the following command to record current measurements as the new baseline:
//!
//! ```bash
//! bash scripts/benchmark_regression.sh --update-baseline --contract fungible-allowlist
//! ```
//!
//! Review the diff in `scripts/benchmark_baseline.json` before committing.

extern crate std;

#[cfg(test)]
mod benchmarks {
    use soroban_sdk::{testutils::Address as _, Address, Env, String};

    use crate::contract::{ExampleContract, ExampleContractClient};

    const INITIAL_SUPPLY: i128 = 1_000_000_000;

    struct BenchEnv {
        env: Env,
        admin: Address,
        manager: Address,
    }

    fn setup() -> (BenchEnv, ExampleContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        env.budget().reset_unlimited();

        let admin = Address::generate(&env);
        let manager = Address::generate(&env);
        let name = String::from_str(&env, "Bench Token");
        let symbol = String::from_str(&env, "BNK");

        let address = env.register(
            ExampleContract,
            (name, symbol, &admin, &manager, &INITIAL_SUPPLY),
        );

        // SAFETY: The Env lifetime is tied to the closure; in benchmark tests
        // the Env outlives the client because both are kept alive until the end
        // of the test function.
        let client = unsafe {
            std::mem::transmute::<ExampleContractClient<'_>, ExampleContractClient<'static>>(
                ExampleContractClient::new(&env, &address),
            )
        };

        (BenchEnv { env, admin, manager }, client)
    }

    // ─── bench_allowed ────────────────────────────────────────────────────────

    #[test]
    fn bench_allowed() {
        let (b, client) = setup();

        b.env.budget().reset_default();
        let _ = client.allowed(&b.admin);
        let cpu = b.env.budget().cpu_instructions();
        std::println!("bench_allowed: cpu_insns = {}", cpu);
    }

    // ─── bench_allow_user ─────────────────────────────────────────────────────

    #[test]
    fn bench_allow_user() {
        let (b, client) = setup();
        let user = Address::generate(&b.env);

        b.env.budget().reset_default();
        client.allow_user(&user, &b.manager);
        let cpu = b.env.budget().cpu_instructions();
        std::println!("bench_allow_user: cpu_insns = {}", cpu);
    }

    // ─── bench_disallow_user ─────────────────────────────────────────────────

    #[test]
    fn bench_disallow_user() {
        let (b, client) = setup();
        let user = Address::generate(&b.env);

        // Setup: allow the user first (not measured)
        b.env.budget().reset_unlimited();
        client.allow_user(&user, &b.manager);

        b.env.budget().reset_default();
        client.disallow_user(&user, &b.manager);
        let cpu = b.env.budget().cpu_instructions();
        std::println!("bench_disallow_user: cpu_insns = {}", cpu);
    }

    // ─── bench_transfer ───────────────────────────────────────────────────────

    #[test]
    fn bench_transfer() {
        let (b, client) = setup();
        let recipient = Address::generate(&b.env);

        // Setup: allow the recipient (not measured)
        b.env.budget().reset_unlimited();
        client.allow_user(&recipient, &b.manager);

        b.env.budget().reset_default();
        client.transfer(&b.admin, &recipient, &1_000);
        let cpu = b.env.budget().cpu_instructions();
        std::println!("bench_transfer: cpu_insns = {}", cpu);
    }

    // ─── bench_approve ────────────────────────────────────────────────────────

    #[test]
    fn bench_approve() {
        let (b, client) = setup();
        let spender = Address::generate(&b.env);

        b.env.budget().reset_default();
        client.approve(&b.admin, &spender, &5_000, &1000);
        let cpu = b.env.budget().cpu_instructions();
        std::println!("bench_approve: cpu_insns = {}", cpu);
    }

    // ─── bench_transfer_from ─────────────────────────────────────────────────

    #[test]
    fn bench_transfer_from() {
        let (b, client) = setup();
        let spender = Address::generate(&b.env);
        let recipient = Address::generate(&b.env);

        // Setup: approve spender + allow recipient (not measured)
        b.env.budget().reset_unlimited();
        client.approve(&b.admin, &spender, &5_000, &1000);
        client.allow_user(&recipient, &b.manager);

        b.env.budget().reset_default();
        client.transfer_from(&spender, &b.admin, &recipient, &1_000);
        let cpu = b.env.budget().cpu_instructions();
        std::println!("bench_transfer_from: cpu_insns = {}", cpu);
    }

    // ─── bench_balance ────────────────────────────────────────────────────────

    #[test]
    fn bench_balance() {
        let (b, client) = setup();

        b.env.budget().reset_default();
        let _ = client.balance(&b.admin);
        let cpu = b.env.budget().cpu_instructions();
        std::println!("bench_balance: cpu_insns = {}", cpu);
    }
}
