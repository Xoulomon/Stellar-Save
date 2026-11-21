# guess-the-number

> **Example / Demo contract — NOT for production deployment.**

This crate contains a simple number-guessing game implemented as a Soroban
smart contract.  Its purpose is to demonstrate:

- Contract constructor (`__constructor`) patterns on Soroban
- Cross-contract XLM token interactions via `stellar-tokens`
- Admin-controlled state reset
- Basic authentication patterns (`require_auth`)

## Purpose

`guess-the-number` is a teaching and exploration tool.  It is intentionally
simple and does **not** implement the security hardening required for
production contracts.

## Production deployment scope

This contract is **excluded** from all testnet and mainnet deployment
scripts (`scripts/deploy_testnet.sh`, `scripts/deploy_mainnet.sh`).  The
scripts skip any directory named `guess-the-number` explicitly.  It will
therefore never appear in any official Stellar-Save deployment.

## Debug affordances

The internal `number()` function that reads the current secret number from
storage is **private** (`fn number`) and only accessible within this crate.
It is used exclusively in the test suite (`src/test.rs`) and is not callable
from outside the crate binary.  No public or `pub(crate)` answer-revealing
getter is exposed.

## Running the tests

```bash
cargo test -p guess-the-number
```

## How it works

1. Deployer calls `__constructor(admin)`, which seeds the contract with 1 XLM
   and picks a random number in `1..=10`.
2. A player calls `guess(n, guesser_address)`.
   - Correct guess → player wins the contract's entire XLM balance.
   - Wrong guess  → player pays 1 XLM into the contract pot.
3. The admin can call `reset()` to set a new number and `add_funds(amount)` to
   top up the prize pool.
