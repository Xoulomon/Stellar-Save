//! Performance Benchmark Tests for nft-enumerable contract.
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
//! bash scripts/benchmark_regression.sh --update-baseline --contract nft-enumerable
//! ```
//!
//! Review the diff in `scripts/benchmark_baseline.json` before committing.

extern crate std;

#[cfg(test)]
mod benchmarks {
    use soroban_sdk::{testutils::Address as _, Address, Env, String};

    use crate::contract::{ExampleContract, ExampleContractClient};

    fn setup() -> (Env, ExampleContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        env.budget().reset_unlimited();

        let owner = Address::generate(&env);
        let uri = String::from_str(&env, "www.mytoken.com");
        let name = String::from_str(&env, "Benchmark Token");
        let symbol = String::from_str(&env, "BNK");
        let address = env.register(ExampleContract, (uri, name, symbol, &owner));

        // SAFETY: The Env lifetime is tied to the closure; in benchmark tests
        // the Env outlives the client because both are kept alive until the end
        // of the test function.
        let client = unsafe {
            std::mem::transmute::<ExampleContractClient<'_>, ExampleContractClient<'static>>(
                ExampleContractClient::new(&env, &address),
            )
        };
        (env, client)
    }

    // ─── bench_mint ───────────────────────────────────────────────────────────

    #[test]
    fn bench_mint() {
        let (env, client) = setup();
        let owner = Address::generate(&env);

        env.budget().reset_default();
        client.mint(&owner);
        let cpu = env.budget().cpu_instructions();
        std::println!("bench_mint: cpu_insns = {}", cpu);
    }

    // ─── bench_transfer ───────────────────────────────────────────────────────

    #[test]
    fn bench_transfer() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let recipient = Address::generate(&env);

        // Setup: mint a token (not measured)
        env.budget().reset_unlimited();
        client.mint(&owner);

        env.budget().reset_default();
        client.transfer(&owner, &recipient, &0);
        let cpu = env.budget().cpu_instructions();
        std::println!("bench_transfer: cpu_insns = {}", cpu);
    }

    // ─── bench_burn ──────────────────────────────────────────────────────────

    #[test]
    fn bench_burn() {
        let (env, client) = setup();
        let owner = Address::generate(&env);

        env.budget().reset_unlimited();
        client.mint(&owner);

        env.budget().reset_default();
        client.burn(&owner, &0);
        let cpu = env.budget().cpu_instructions();
        std::println!("bench_burn: cpu_insns = {}", cpu);
    }

    // ─── bench_approve ────────────────────────────────────────────────────────

    #[test]
    fn bench_approve() {
        let (env, client) = setup();
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);

        env.budget().reset_unlimited();
        client.mint(&owner);

        env.budget().reset_default();
        client.approve(&owner, &spender, &0, &1000);
        let cpu = env.budget().cpu_instructions();
        std::println!("bench_approve: cpu_insns = {}", cpu);
    }

    // ─── bench_total_supply ───────────────────────────────────────────────────

    #[test]
    fn bench_total_supply() {
        let (env, client) = setup();
        let owner = Address::generate(&env);

        env.budget().reset_unlimited();
        client.mint(&owner);
        client.mint(&owner);

        env.budget().reset_default();
        let _ = client.total_supply();
        let cpu = env.budget().cpu_instructions();
        std::println!("bench_total_supply: cpu_insns = {}", cpu);
    }

    // ─── bench_balance ────────────────────────────────────────────────────────

    #[test]
    fn bench_balance() {
        let (env, client) = setup();
        let owner = Address::generate(&env);

        env.budget().reset_unlimited();
        client.mint(&owner);

        env.budget().reset_default();
        let _ = client.balance(&owner);
        let cpu = env.budget().cpu_instructions();
        std::println!("bench_balance: cpu_insns = {}", cpu);
    }

    // ─── bench_get_owner_token_id ─────────────────────────────────────────────

    #[test]
    fn bench_get_owner_token_id() {
        let (env, client) = setup();
        let owner = Address::generate(&env);

        env.budget().reset_unlimited();
        client.mint(&owner);

        env.budget().reset_default();
        let _ = client.get_owner_token_id(&owner, &0);
        let cpu = env.budget().cpu_instructions();
        std::println!("bench_get_owner_token_id: cpu_insns = {}", cpu);
    }
}
