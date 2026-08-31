# Stellar-Save Soroban Smart Contract

The core savings and ROSCA (Rotating Savings and Credit Association) smart contract for the Stellar-Save platform, built on Soroban / Stellar Rust SDK.

## Key Features

- Automated contribution cycles and payout schedules
- Membership management & insurance pool options
- On-chain transparency and event emission
- Upgradable contract architecture with SchemaVersion guards

## Upgrades & Migrations Runbook

For complete instructions on performing contract WASM upgrades, executing schema migrations, pre/post upgrade checklists, and rollback procedures, see:

- [Contract Upgrade & Migration Runbook](../../docs/runbooks/contract-upgrade.md)
- [Upgrade Testing Strategy & Infrastructure](./UPGRADE_TESTING.md)

## Running Tests

```bash
cargo test --manifest-path contracts/stellar-save/Cargo.toml
```
