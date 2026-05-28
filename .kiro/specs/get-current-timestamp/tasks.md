# Implementation Plan: get-current-timestamp

## Overview

Add a `get_current_timestamp` public method to `StellarSaveContract` in `contracts/stellar-save/src/lib.rs`. The function wraps `env.ledger().timestamp()` and returns a `u64`. No new modules, storage keys, or data types are needed.

## Tasks

- [x] 1. Add `get_current_timestamp` to `StellarSaveContract`
  - Add the public method to the `#[contractimpl]` block in `contracts/stellar-save/src/lib.rs`
  - Signature: `pub fn get_current_timestamp(env: Env) -> u64`
  - Body: `env.ledger().timestamp()`
  - No storage access, no auth check, no pause-state check
  - _Requirements: 1.1, 1.2, 1.3, 2.1_

  - [ ]* 1.1 Write unit tests for `get_current_timestamp`
    - Test basic invocation: set ledger timestamp to a known value `T`, assert return equals `T`
    - Test idempotence: call twice in the same ledger state, assert both calls return the same value
    - Test non-zero return: set timestamp > 0, assert result > 0
    - Test paused contract: initialize and pause the contract, assert `get_current_timestamp` still returns the correct ledger timestamp
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 1.2 Write property test for `get_current_timestamp` — Property 1: Timestamp round-trip
    - **Property 1: Timestamp round-trip** — for any `t: u64` in `1..=u64::MAX`, setting the ledger timestamp to `t` and calling `get_current_timestamp` must return exactly `t`
    - Use `proptest!` macro with `soroban_sdk::Env::default()` and `env.ledger().with_mut(|l| l.timestamp = t)`
    - Tag with comment: `// Feature: get-current-timestamp, Property 1: Timestamp round-trip`
    - **Validates: Requirements 1.2, 1.4, 2.2, 2.3, 3.2, 3.3, 3.4**

- [x] 2. Checkpoint — Ensure all tests pass
  - Run `cargo test -p stellar-save` and confirm all existing tests plus the new tests pass. Ask the user if any questions arise.
