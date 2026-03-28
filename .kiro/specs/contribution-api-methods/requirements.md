# Requirements Document

## Introduction

This feature implements the `frontend/src/utils/contributionApi.ts` module, providing production-ready API methods for contribution operations in the StellarSave frontend. The module exposes four high-level async functions — `contribute`, `getContributionStatus`, `getContributionHistory`, and `hasContributed` — that delegate to the Soroban smart contract via `contractClient`. Because the on-chain contract has no direct history or per-cycle contribution flag query, `getContributionHistory` and `hasContributed` are derived by composing available contract reads (`getMemberTotalContributions`, `isCycleComplete`, `getContributionDeadline`, `getMemberCount`, `getPayoutSchedule`). All errors are normalised to `ContractError` instances so that consuming hooks and components have a uniform error-handling surface.

## Glossary

- **ContributionApi**: The module at `frontend/src/utils/contributionApi.ts` that exposes high-level async functions for contribution operations.
- **ContractClient**: The existing low-level module at `frontend/src/lib/contractClient.ts` that handles XDR encoding, transaction building, Freighter signing, and RPC submission.
- **ContractError**: The typed error class exported by `ContractClient` carrying a numeric `code` and a human-readable `message`.
- **parseContractError**: The utility function exported by `ContractClient` that normalises any thrown value into a `ContractError`.
- **Stroops**: The smallest unit of XLM (1 XLM = 10,000,000 stroops), used internally by the contract for all monetary values.
- **Cycle**: A single round of contributions within a savings group, identified by a zero-based `cycleNumber`.
- **ContributionStatus**: A domain object describing the current cycle's state for a group — deadline, member count, how many have contributed, and whether the cycle is complete.
- **ContributionRecord**: A domain object representing a single cycle's contribution data for a member — cycle number, amount contributed, deadline, and whether the cycle was complete.
- **Freighter**: The Stellar browser wallet extension used to sign transactions.
- **GroupId**: A `bigint` uniquely identifying a savings group on-chain.

---

## Requirements

### Requirement 1: contribute

**User Story:** As a frontend developer, I want a `contributionApi.contribute` function that submits a real on-chain contribution transaction, so that members can contribute to their savings group from the UI.

#### Acceptance Criteria

1. WHEN `contributionApi.contribute` is called with a valid `groupId` (string), `amount` (number, in XLM), and `memberAddress` (string), THE `ContributionApi` SHALL convert `groupId` to `bigint`, convert `amount` from XLM to stroops (multiply by 10,000,000), and delegate to `ContractClient.contribute`.
2. WHEN the transaction is confirmed on-chain, THE `ContributionApi` SHALL return the transaction hash as a `string`.
3. IF the member has already contributed this cycle (contract error code `3002`), THEN THE `ContributionApi` SHALL re-throw the `ContractError` unchanged so the caller can display an "already contributed" message.
4. IF the contribution amount is invalid (contract error code `3001`), THEN THE `ContributionApi` SHALL re-throw the `ContractError` unchanged so the caller can display an "invalid amount" message.
5. IF `contributionApi.contribute` is called without a `memberAddress`, THEN THE `ContributionApi` SHALL throw a `ContractError` with `code: null` and the message `"Wallet is not connected."`.
6. IF any other `ContractError` is thrown during submission, THEN THE `ContributionApi` SHALL re-throw it unchanged.

---

### Requirement 2: getContributionStatus

**User Story:** As a frontend developer, I want a `contributionApi.getContributionStatus` function that returns the current cycle's contribution state for a group, so that the UI can display deadline, progress, and member participation.

#### Acceptance Criteria

1. WHEN `contributionApi.getContributionStatus` is called with a valid `groupId` (string) and `cycleNumber` (number), THE `ContributionApi` SHALL convert `groupId` to `bigint` and call `ContractClient.getContributionDeadline`, `ContractClient.isCycleComplete`, and `ContractClient.getMemberCount` in parallel.
2. WHEN all contract reads succeed, THE `ContributionApi` SHALL return a `ContributionStatus` object containing: `cycleNumber`, `deadline` (as a JavaScript `Date` converted from the Unix timestamp bigint), `totalMembers` (number), `isComplete` (boolean), and `contributedCount` (number, derived as described in criterion 3).
3. WHEN `isCycleComplete` returns `true`, THE `ContributionApi` SHALL set `contributedCount` equal to `totalMembers`. WHEN `isCycleComplete` returns `false`, THE `ContributionApi` SHALL set `contributedCount` to `0` as a safe default (exact per-member tracking is not available on-chain without iterating all members).
4. IF a `ContractError` is thrown during any of the parallel reads, THEN THE `ContributionApi` SHALL re-throw it unchanged.
5. THE `ContributionApi` SHALL NOT return mock or hardcoded data from `getContributionStatus`.

---

### Requirement 3: getContributionHistory

**User Story:** As a frontend developer, I want a `contributionApi.getContributionHistory` function that returns a member's contribution history across cycles, so that the member profile and history views can display past contributions.

#### Acceptance Criteria

1. WHEN `contributionApi.getContributionHistory` is called with a valid `groupId` (string) and `memberAddress` (string), THE `ContributionApi` SHALL convert `groupId` to `bigint` and fetch `ContractClient.getMemberTotalContributions`, `ContractClient.getPayoutSchedule`, and `ContractClient.getMemberCount` to derive history.
2. WHEN the contract reads succeed, THE `ContributionApi` SHALL derive per-cycle records by iterating over the payout schedule entries to determine the number of cycles, then for each cycle calling `ContractClient.isCycleComplete` and `ContractClient.getContributionDeadline`.
3. THE `ContributionApi` SHALL return an array of `ContributionRecord` objects, each containing: `cycleNumber` (number), `deadline` (Date), `isComplete` (boolean), `amountContributed` (number in XLM, derived by dividing `getMemberTotalContributions` evenly across complete cycles), and `txHash` (undefined, as on-chain history does not expose individual tx hashes).
4. WHEN the payout schedule is empty or the member has no contributions, THE `ContributionApi` SHALL return an empty array `[]`.
5. IF a `ContractError` is thrown during any contract read, THEN THE `ContributionApi` SHALL re-throw it unchanged.
6. THE `ContributionApi` SHALL document in a code comment that per-cycle amounts are approximated because the contract does not expose individual cycle contribution records.

---

### Requirement 4: hasContributed

**User Story:** As a frontend developer, I want a `contributionApi.hasContributed` function that checks whether a specific member has contributed in a given cycle, so that the UI can show per-member contribution badges and disable the contribute button when appropriate.

#### Acceptance Criteria

1. WHEN `contributionApi.hasContributed` is called with a valid `groupId` (string), `memberAddress` (string), and `cycleNumber` (number), THE `ContributionApi` SHALL convert `groupId` to `bigint` and call `ContractClient.getMemberTotalContributions` and `ContractClient.isCycleComplete` in parallel.
2. WHEN `isCycleComplete` returns `true`, THE `ContributionApi` SHALL return `true` (all members have contributed if the cycle is complete).
3. WHEN `isCycleComplete` returns `false` and `getMemberTotalContributions` returns a value greater than `0n`, THE `ContributionApi` SHALL return `true`.
4. WHEN `isCycleComplete` returns `false` and `getMemberTotalContributions` returns `0n`, THE `ContributionApi` SHALL return `false`.
5. IF a `ContractError` is thrown during any contract read, THEN THE `ContributionApi` SHALL re-throw it unchanged.
6. THE `ContributionApi` SHALL document in a code comment that this derivation is a best-effort heuristic because the contract does not expose a direct per-cycle contribution flag per member.

---

### Requirement 5: Consistent Error Handling

**User Story:** As a frontend developer, I want all errors from `contributionApi` functions to be `ContractError` instances, so that error handling in hooks and components is uniform.

#### Acceptance Criteria

1. WHEN any `ContributionApi` function catches a thrown value that is already a `ContractError`, THE `ContributionApi` SHALL re-throw it unchanged without double-wrapping.
2. WHEN any `ContributionApi` function catches a non-`ContractError` value, THE `ContributionApi` SHALL pass it through `parseContractError` and re-throw the resulting `ContractError`.
3. THE `ContributionApi` SHALL NOT swallow errors silently; every caught error SHALL result in a thrown `ContractError`.
4. THE `ContributionApi` SHALL NOT expose raw `Record<string, unknown>` or untyped `unknown` values in any public function signature.

---

### Requirement 6: Domain Type Mapping

**User Story:** As a frontend developer, I want all `contributionApi` functions to return properly typed domain objects, so that I get compile-time safety and IDE autocompletion when consuming contribution data.

#### Acceptance Criteria

1. THE `ContributionApi` SHALL export a `ContributionStatus` interface with fields: `cycleNumber: number`, `deadline: Date`, `totalMembers: number`, `contributedCount: number`, `isComplete: boolean`.
2. THE `ContributionApi` SHALL export a `ContributionRecord` interface with fields: `cycleNumber: number`, `deadline: Date`, `isComplete: boolean`, `amountContributed: number`, `txHash: string | undefined`.
3. WHEN mapping contract data to domain types, THE `ContributionApi` SHALL convert all `bigint` monetary values from stroops to XLM by dividing by `10_000_000`.
4. WHEN mapping contract data to domain types, THE `ContributionApi` SHALL convert all `bigint` Unix timestamps to JavaScript `Date` objects by multiplying by `1000` and passing to `new Date()`.
5. THE `ContributionApi` SHALL NOT export `Record<string, unknown>` or raw contract response types as part of its public API surface.
