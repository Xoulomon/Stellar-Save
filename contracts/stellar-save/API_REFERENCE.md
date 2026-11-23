# Contract entrypoint API reference

This reference summarizes the public Soroban contract interface exposed by
`StellarSaveContract`. The `#[contractimpl]` in [`src/contract.rs`](src/contract.rs)
is the source of truth for signatures and serialized argument names; build the
complete version-specific Rust API docs with `cargo doc -p stellar-save --no-deps`.

## Units and call conventions

- Amounts are signed `i128` values in stroops (1 XLM = 10,000,000 stroops).
- Durations and ledger timestamps are `u64` seconds; cycle numbers are `u32`.
- `env: Env` is supplied by Soroban and is omitted from CLI examples unless
  required by the client binding.
- Methods returning `Result<T, StellarSaveError>` return the documented value
  on success or a contract error on failure. Soroban authorization is enforced
  with `require_auth` for the relevant address parameters.

## Group lifecycle

| Entrypoint | Arguments (excluding `env`) | Result | Authorization / effect |
|---|---|---|---|
| `create_group` | `creator: Address`, `contribution_amount: i128`, `cycle_duration: u64`, `max_members: u32`, `token_address: Address`, `grace_period_seconds: u64`, `payout_order: PayoutOrder` | `u64` group ID | Creator authorizes; amount is rounded to 0.01 XLM; creates a pending group. |
| `join_group` | `group_id: u64`, `member: Address`, `referrer: Option<Address>` | `()` | Member authorizes; group must be pending and have capacity; invitation rules apply. |
| `activate_group` | `group_id: u64`, `creator: Address` | `()` | Creator-authorized start after the minimum member count is met. |
| `update_group` | `group_id: u64`, `new_contribution: i128`, `new_duration: u64`, `new_max_members: u32` | `()` | Creator-only group configuration update subject to lifecycle rules. |
| `cancel_group` | `group_id: u64`, `caller: Address` | `()` | Cancels a group subject to its state and authorization rules. |
| `pause_group` / `unpause_group` | `group_id: u64`, `caller: Address` | `()` | Creator-controlled group pause and resume. |

## Contributions and payouts

| Entrypoint | Arguments (excluding `env`) | Result | Effect |
|---|---|---|---|
| `contribute` | `group_id: u64`, `member: Address`, `amount: i128` | `()` | Authorized member transfers the configured SEP-41 token contribution into contract custody for the active cycle. |
| `contribute_batch` | `group_id: u64`, `member: Address`, `cycles: Vec<u32>` | `()` | Records the member's contributions for the specified cycles in one invocation. |
| `execute_payout` | `group_id: u64` | `()` | Transfers the completed cycle's pool to its scheduled recipient and advances the cycle. |
| `tick` | `group_id: u64` | `()` | Permissionless deadline-based cycle advancement. |
| `request_refund` | `group_id: u64`, `cycle: u32`, `caller: Address` | `RefundRecord` | Requests an eligible refund; caller must be the contributor or group creator. |
| `get_payout_schedule` | `group_id: u64` | `Vec<PayoutScheduleEntry>` | Reads the group's payout schedule. |
| `get_group_balance` | `group_id: u64` | `i128` | Reads the accounted group balance in stroops. |

## Queries and administration

Common query entrypoints include `get_group`, `get_members`, `get_member`,
`is_member`, `get_member_count`, `get_contribution_status`,
`get_cycle_contributions`, `get_payout_history`, `get_total_paid_out`,
`is_payout_due`, `is_complete`, `list_groups`, and `search_groups`. Their exact
arguments and return types are available in the generated Rust documentation.

Administrative entrypoints include `update_config`, `update_contribution_limits`,
`add_allowed_token`, `remove_allowed_token`, `pause_contract`, `unpause_contract`,
`migrate_storage`, and `upgrade_contract`. Admin actions require the configured
admin's authorization. `upgrade_contract` takes a 32-byte replacement WASM hash
and a strictly increasing `new_version`; storage schema migration is a separate
operation.

## Errors and compatibility

Operations may return `StellarSaveError` variants including `GroupNotFound`,
`GroupFull`, `AlreadyMember`, `NotMember`, `Unauthorized`, `InvalidAmount`,
`InvalidState`, `AlreadyContributed`, `CycleNotComplete`, `DeadlineNotReached`,
`CycleDeadlineExpired`, `InvalidToken`, `TokenTransferFailed`, `PayoutFailed`,
and `Overflow`. The exact error set can evolve; use the crate's
[`src/error.rs`](src/error.rs) and generated docs for the version being called.

### Create a group with the Stellar CLI

```sh
stellar contract invoke \
  --id CONTRACT_ID \
  --network testnet \
  -- create_group \
  --creator CREATOR_ADDRESS \
  --contribution_amount 100000000 \
  --cycle_duration 604800 \
  --max_members 5 \
  --token_address TOKEN_CONTRACT_ADDRESS \
  --grace_period_seconds 86400 \
  --payout_order Sequential
```

## Validation

Run the contract unit tests with `cargo test -p stellar-save`. Review this
reference against `src/contract.rs` whenever an entrypoint signature or behavior
changes.
