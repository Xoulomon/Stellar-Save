# Troubleshooting Guide

This guide covers common issues users encounter with Stellar-Save, along with step-by-step solutions and diagnostic commands.

## Table of Contents

- [Diagnostic Tools](#diagnostic-tools)
- [Setup & Environment Issues](#setup--environment-issues)
- [Wallet & Connection Issues](#wallet--connection-issues)
- [Group Management Issues](#group-management-issues)
- [Contribution Issues](#contribution-issues)
- [Payout Issues](#payout-issues)
- [Token Issues](#token-issues)
- [Error Code Reference](#error-code-reference)
- [Getting Further Help](#getting-further-help)

---

## Diagnostic Tools

Before diving into specific issues, these commands help you gather information about the current state.

**Check contract state for a group:**
```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- get_group \
  --group_id <GROUP_ID>
```

**List group members:**
```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- list_members \
  --group_id <GROUP_ID>
```

**Check contribution status for a cycle:**
```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- get_contribution_status \
  --group_id <GROUP_ID> \
  --cycle_number <CYCLE>
```

**Check if a group is complete:**
```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- is_complete \
  --group_id <GROUP_ID>
```

**Check your XLM balance:**
```bash
stellar account show <YOUR_ADDRESS> --network testnet
```

**View recent contract events (Horizon API):**
```bash
curl "https://horizon-testnet.stellar.org/accounts/<CONTRACT_ID>/transactions?limit=10&order=desc"
```

**Run the smoke test after deployment:**
```bash
./scripts/smoke_test_post_deploy.sh
```

---

## Setup & Environment Issues

### Build fails with "rustup: command not found"

Rust is not installed or not on your PATH.

1. Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
2. Reload your shell: `source ~/.cargo/env`
3. Verify: `rustc --version`

### Build fails with "wasm32-unknown-unknown target not found"

The WebAssembly target is missing.

```bash
rustup target add wasm32-unknown-unknown
```

### `stellar` CLI command not found

Install the Stellar CLI:
```bash
cargo install --locked stellar-cli --features opt
```

Or follow the [official setup guide](https://developers.stellar.org/docs/tools/stellar-cli).

### Contract build produces oversized WASM

The contract WASM exceeds Soroban's size limit.

```bash
# Check current size
./scripts/check_contract_size.sh

# Build with optimizations
./scripts/build.sh
```

See [docs/size-optimization.md](size-optimization.md) for further reduction strategies.

### Environment variables not set

Copy the example file and fill in your values:
```bash
cp .env.example .env
# Edit .env with your CONTRACT_ID and network settings
```

Required variables:
- `STELLAR_NETWORK` — `testnet`, `mainnet`, or `standalone`
- `STELLAR_RPC_URL` — RPC endpoint for your network
- `VITE_STELLAR_NETWORK` — same as above, for the frontend

---

## Wallet & Connection Issues

### Freighter wallet not connecting to the frontend

1. Ensure the Freighter extension is installed and unlocked.
2. Check that Freighter is set to the correct network (Testnet vs Mainnet) — it must match `VITE_STELLAR_NETWORK`.
3. Open the browser console (`F12`) and look for errors.
4. Try refreshing the page and reconnecting.

### Transaction rejected by wallet

- Confirm you have enough XLM to cover the contribution **plus** the Stellar network fee (~0.00001 XLM per operation).
- Check that the wallet address you are signing with is the same address that joined the group.

### "Account not found" on testnet

Your account needs to be funded on testnet before it can transact:
```bash
stellar keys fund <YOUR_ADDRESS> --network testnet
```

Or use the [Stellar Friendbot](https://friendbot.stellar.org/?addr=<YOUR_ADDRESS>).

---

## Group Management Issues

### Error 1001 — GroupNotFound

The group ID does not exist on-chain.

- Double-check the `group_id` value.
- Confirm you are querying the correct contract address and network.
- The group may have been created on a different network (testnet vs mainnet).

### Error 1002 — GroupFull

The group has reached its `max_members` limit.

- Ask the group creator to create a new group with a higher `max_members`.
- Wait for an existing member to leave (note: leaving mid-cycle is restricted).

### Error 1003 — InvalidState

The operation is not allowed in the group's current state.

- Check the group status with `get_group`.
- Common causes:
  - Trying to join a group that is `Paused` or `Completed`.
  - Calling `execute_payout` on a group that is `Paused`.
  - Calling `contribute` on a `Completed` group.

### Error 1004 — InvalidMetadata

Group name or description does not meet requirements.

- Name: 3–50 characters.
- Description: 0–500 characters.
- Image URL: must be a valid URL if provided.

### Error 1005 — MergeIncompatible

Two groups cannot be merged because their parameters differ.

- Both groups must have the same `contribution_amount` and `cycle_duration`.

### Error 1006 — DisputeActive

A dispute is blocking payouts for this group.

- Wait for the dispute to be resolved by the group creator or admin.
- Contact the group creator to resolve the dispute.

### Error 1007 — GroupNotArchivable

Only groups in a terminal state (`Completed` or `Cancelled`) can be archived.

- Wait until all cycles finish, or have the creator cancel the group first.

### Group is stuck in Paused state

Only the group creator can unpause:
```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  --source <CREATOR_KEY> \
  -- unpause_group \
  --group_id <GROUP_ID> \
  --caller <CREATOR_ADDRESS>
```

---

## Contribution Issues

### Error 2001 — AlreadyMember

You are already a member of this group. Each address can only join once.

### Error 2002 — NotMember

You must join the group before contributing:
```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  --source <YOUR_KEY> \
  -- join_group \
  --group_id <GROUP_ID>
```

### Error 2003 — Unauthorized

You do not have permission for this operation.

- `pause_group` / `unpause_group` / `cancel_group` are creator-only.
- `contribute` requires you to be a member.
- Verify you are signing with the correct key.

### Error 2004 — NotInvited

The group is invitation-only and your address has not been invited.

- Ask the group creator to invite your address.

### Error 3001 — InvalidAmount

The amount you sent does not match the group's required `contribution_amount`.

- Retrieve the exact required amount: `get_group --group_id <ID>` and check `contribution_amount`.
- Amounts must be exact — no more, no less.

### Error 3002 — AlreadyContributed

You have already contributed for the current cycle. Wait for the next cycle to begin.

### Error 3005 — CycleDeadlineExpired

The deadline for the current cycle has passed.

- Contributions are no longer accepted for this cycle.
- The group creator may extend the deadline (up to 7 days) using `extend_deadline`.

### Error 3006 / 3007 — ContributionTooLow / ContributionTooHigh

Your amount is outside the group's configured min/max contribution range. Check the group configuration and adjust your amount.

### Error 3008 — InsufficientBalance

Your token balance is too low for auto-contribution.

- Top up your wallet balance before the cycle starts.
- Alternatively, disable auto-contribution for your account.

---

## Payout Issues

### Error 3003 — CycleNotComplete

Not all members have contributed yet. The payout cannot execute until every member has contributed for the current cycle.

Check who has not yet contributed:
```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- get_contribution_status \
  --group_id <GROUP_ID> \
  --cycle_number <CURRENT_CYCLE>
```

### Error 4001 — PayoutFailed

The payout transfer failed. Possible causes:

- The contract escrow has insufficient funds (should not happen in normal operation — report as a bug).
- The recipient's account has restrictions (e.g., no trustline for a custom token).
- Network congestion — retry the transaction.

### Error 4002 — PayoutAlreadyProcessed

The payout for this cycle has already been executed. Check the next cycle.

### Error 4003 — InvalidRecipient

The address is not the designated recipient for this cycle. Payouts rotate in join order — check the payout queue with `get_group`.

### Error 6003 — AlreadyRefunded

This contribution has already been refunded. Each contribution can only be refunded once.

### Error 6004 — RefundNotEligible

Refunds are not available while the group is active and a payout has already occurred for the cycle.

---

## Token Issues

### Error 5001 — InvalidToken

The token address is not a valid SEP-41 token or is not on the allowed token list.

- Verify the token contract address is correct.
- If the contract uses an allowlist, confirm the token has been added by the admin.
- Currently, only XLM is supported in v1.0. Custom token support is planned for v1.1.

### Error 5002 — TokenTransferFailed

The token transfer from your account to the contract failed.

For custom tokens, you must approve the contract to spend your tokens before contributing:
```bash
stellar contract invoke \
  --id <TOKEN_CONTRACT_ID> \
  --network testnet \
  --source <YOUR_KEY> \
  -- approve \
  --from <YOUR_ADDRESS> \
  --spender <STELLAR_SAVE_CONTRACT_ID> \
  --amount <CONTRIBUTION_AMOUNT> \
  --expiration_ledger <FUTURE_LEDGER>
```

Then retry the contribution.

---

## Error Code Reference

| Code | Name | Category | Retryable |
|------|------|----------|-----------|
| 1001 | GroupNotFound | Group | No |
| 1002 | GroupFull | Group | No |
| 1003 | InvalidState | Group | No |
| 1004 | InvalidMetadata | Group | No |
| 1005 | MergeIncompatible | Group | No |
| 1006 | DisputeActive | Group | No |
| 1007 | GroupNotArchivable | Group | No |
| 2001 | AlreadyMember | Member | No |
| 2002 | NotMember | Member | No |
| 2003 | Unauthorized | Member | No |
| 2004 | NotInvited | Member | No |
| 3001 | InvalidAmount | Contribution | No |
| 3002 | AlreadyContributed | Contribution | No |
| 3003 | CycleNotComplete | Contribution | Yes |
| 3004 | ContributionNotFound | Contribution | No |
| 3005 | CycleDeadlineExpired | Contribution | No |
| 3006 | ContributionTooLow | Contribution | No |
| 3007 | ContributionTooHigh | Contribution | No |
| 3008 | InsufficientBalance | Contribution | No |
| 4001 | PayoutFailed | Payout | Yes |
| 4002 | PayoutAlreadyProcessed | Payout | No |
| 4003 | InvalidRecipient | Payout | No |
| 5001 | InvalidToken | Token | No |
| 5002 | TokenTransferFailed | Token | No |
| 6001 | RewardAlreadyClaimed | Reward | No |
| 6002 | RewardNotEligible | Reward | No |
| 6003 | AlreadyRefunded | Reward | No |
| 6004 | RefundNotEligible | Reward | No |
| 7001 | DeadlineExtensionExceedsMax | Deadline | No |
| 9001 | InternalError | System | Yes |
| 9002 | DataCorruption | System | No |
| 9003 | Overflow | System | No |

> **Retryable** errors may succeed if you retry the transaction. All others require fixing the underlying condition first.

---

## Getting Further Help

If your issue is not covered here:

1. **Search existing issues**: [GitHub Issues](https://github.com/Xoulomon/Stellar-Save/issues)
2. **Ask in Discussions**: [GitHub Discussions](https://github.com/Xoulomon/Stellar-Save/discussions)
3. **Report a bug**: Open a new issue with:
   - The error code and full error message
   - The contract ID and network you are using
   - The transaction hash (if available)
   - Steps to reproduce
4. **Security vulnerabilities**: Follow the [responsible disclosure process](../SECURITY.md) — do not open a public issue.

For video walkthroughs of common flows, see [docs/video-tutorials.md](video-tutorials.md).
