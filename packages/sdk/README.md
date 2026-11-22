# @stellar-save/sdk

Shared TypeScript SDK for Stellar-Save: display formatting, address validation, and shared domain types.

## Installation

```bash
pnpm add @stellar-save/sdk
```

## ABI Drift Test

The SDK includes a test that verifies its contract function definitions match the live contract ABI. This helps catch silent drift after contract changes.

### Running the ABI Drift Check

```bash
pnpm check:abi
```

This runs a Vitest test (`src/abi-drift.test.ts`) that compares `CONTRACT_FUNCTIONS` in `src/contract.ts` against the canonical list in `src/contractAbi.json`.

### Updating the Contract ABI

When the contract is upgraded with new functions:

1. Update `src/contractAbi.json` with the new method list from the deployed contract
2. Add corresponding entries to `CONTRACT_FUNCTIONS` in `src/contract.ts`
3. Run `pnpm check:abi` to verify the match
4. Commit both files

### Not Run in CI

This check is intentionally **not** part of the CI pipeline. It should be run manually:

- Before releasing a new SDK version
- After a contract upgrade is deployed
- When adding new contract function bindings

The reason: it requires the `contractAbi.json` to be manually updated from the live contract, which is a human-driven process.