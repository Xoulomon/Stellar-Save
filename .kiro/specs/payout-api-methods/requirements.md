# Requirements Document

## Introduction

This feature implements the `frontend/src/utils/payoutApi.ts` module, providing production-ready API methods for payout operations in the StellarSave frontend. The module exposes four high-level async functions — `executePayout`, `getPayoutQueue`, `getPayoutHistory`, and `getNextRecipient` — that delegate to the Soroban smart contract via `contractClient`. Because the on-chain contract has no direct payout history query, `getPayoutHistory` is derived by composing `getPayoutSchedule` with `hasReceivedPayout` checks per member. Similarly, `getNextRecipient` is derived by finding the first schedule entry whose member has not yet received a payout. All errors are normalised to `ContractError` instances so that consuming hooks and components have a uniform error-handling surface.

## Glossary

- **PayoutApi**: The module at `frontend/src/utils/payoutApi.ts` that exposes high-level async functions for payout operations.
- **ContractClient**: The existing low-level module at `frontend/src/lib/contractClient.ts` that handles XDR encoding, transaction building, Freighter signing, and RPC submission.
- **ContractError**: The typed error class exported by `ContractClient` carrying a numeric `code` and a human-readable `message`.
- **parseContractError**: The utility function exported by `ContractClient` that normalises any thrown value into a `ContractError`.
- **Stroops**: The smallest unit of XLM (1 XLM = 10,000,000 stroops), used internally by the contract for all monetary values.
- **PayoutScheduleEntry**: A contract-level struct with fields `recipient: string`, `cycle: number`, and `payout_date: bigint` (Unix timestamp in seconds).
- **PayoutEntry**: A domain-level object (from `frontend/src/types/contribution.ts`) representing a single member's position in the payout queue, including `position`, `memberAddress`, `estimatedDate`, `amount`, `status`, and optional `txHash`/`paidAt`.
- **PayoutQueueData**: A domain-level object (from `frontend/src/types/contribution.ts`) wrapping the full payout queue for a group, including `cycleId`, `totalMembers`, `entries`, and optional `currentUserAddress`.
- **PayoutStatus**: A union type `'completed' | 'next' | 'upcoming'` indicating a member's payout state.
- **Freighter**: The Stellar browser wallet extension used to sign transactions.
- **GroupId**: A `string` at the API layer (converted to `bigint` internally) uniquely identifying a savings group on-chain.

---

## Requirements

### Requirement 1: executePayout

**User Story:** As a frontend developer, I want a `payoutApi.executePayout` function that submits a real on-chain payout transaction for the next eligible recipient, so that group administrators can trigger payouts from the UI.

#### Acceptance Criteria

1. WHEN `payoutApi.executePayout` is called with a valid `groupId` (string) and `callerAddress` (string), THE `PayoutApi` SHALL convert `groupId` to `bigint`, derive the next recipient address by calling `payoutApi.getNextRecipient`, and delegate to `ContractClient.executePayout` with the derived recipient.
2. WHEN the transaction is confirmed on-chain, THE `PayoutApi` SHALL return the transaction hash as a `string`.
3. IF `payoutApi.executePayout` is called without a `callerAddress`, THEN THE `PayoutApi` SHALL throw a `ContractError` with `code: null` and the message `"Wallet is not connected."`.
4. IF no eligible recipient is found (the payout queue is empty or all members have received payouts), THEN THE `PayoutApi` SHALL throw a `ContractError` with `code: null` and the message `"No eligible recipient found for payout."`.
5. IF the payout has already been processed (contract error code `4002`), THEN THE `PayoutApi` SHALL re-throw the `ContractError` unchanged so the caller can display an "already processed" message.
6. IF the recipient is invalid (contract error code `4003`), THEN THE `PayoutApi` SHALL re-throw the `ContractError` unchanged so the caller can display an "invalid recipient" message.
7. IF any other `ContractError` is thrown during submission, THEN THE `PayoutApi` SHALL re-throw it unchanged.

---

### Requirement 2: getPayoutQueue

**User Story:** As a frontend developer, I want a `payoutApi.getPayoutQueue` function that returns the full payout queue with statuses for a group, so that the UI can display each member's position, estimated payout date, and whether they have been paid.

#### Acceptance Criteria

1. WHEN `payoutApi.getPayoutQueue` is called with a valid `groupId` (string) and optional `currentUserAddress` (string), THE `PayoutApi` SHALL convert `groupId` to `bigint` and call `ContractClient.getPayoutSchedule` and `ContractClient.getMemberCount` in parallel.
2. WHEN the schedule is retrieved, THE `PayoutApi` SHALL call `ContractClient.hasReceivedPayout` for each entry in the schedule to determine completion status.
3. WHEN building the queue, THE `PayoutApi` SHALL assign `PayoutStatus` to each entry as follows: `'completed'` if `hasReceivedPayout` returns `true`; `'next'` for the first entry where `hasReceivedPayout` returns `false`; `'upcoming'` for all subsequent entries where `hasReceivedPayout` returns `false`.
4. WHEN building the queue, THE `PayoutApi` SHALL derive the `amount` for each entry by calling `ContractClient.getGroupBalance` and dividing by `totalMembers` (converting from stroops to XLM).
5. WHEN all data is assembled, THE `PayoutApi` SHALL return a `PayoutQueueData` object with `cycleId` set to the cycle number of the first `'next'` entry (or `0` if all are completed), `totalMembers`, `entries` as an array of `PayoutEntry` objects ordered by position, and `currentUserAddress` if provided.
6. WHEN the payout schedule is empty, THE `PayoutApi` SHALL return a `PayoutQueueData` object with `totalMembers: 0` and `entries: []`.
7. IF a `ContractError` is thrown during any contract read, THEN THE `PayoutApi` SHALL re-throw it unchanged.

---

### Requirement 3: getPayoutHistory

**User Story:** As a frontend developer, I want a `payoutApi.getPayoutHistory` function that returns payout records that have already been processed for a group, so that the UI can display a history of completed payouts.

#### Acceptance Criteria

1. WHEN `payoutApi.getPayoutHistory` is called with a valid `groupId` (string), THE `PayoutApi` SHALL convert `groupId` to `bigint` and call `ContractClient.getPayoutSchedule`.
2. WHEN the schedule is retrieved, THE `PayoutApi` SHALL call `ContractClient.hasReceivedPayout` for each entry in the schedule to determine which members have been paid.
3. THE `PayoutApi` SHALL return an array of `PayoutEntry` objects containing only entries where `hasReceivedPayout` returns `true`, with `status` set to `'completed'` and `paidAt` set to the `payout_date` from the schedule entry (converted from Unix timestamp bigint to a JavaScript `Date`).
4. WHEN the payout schedule is empty or no members have received payouts, THE `PayoutApi` SHALL return an empty array `[]`.
5. THE `PayoutApi` SHALL document in a code comment that `paidAt` is derived from the scheduled `payout_date` rather than an actual on-chain event timestamp, as the contract does not expose individual payout transaction records.
6. IF a `ContractError` is thrown during any contract read, THEN THE `PayoutApi` SHALL re-throw it unchanged.

---

### Requirement 4: getNextRecipient

**User Story:** As a frontend developer, I want a `payoutApi.getNextRecipient` function that returns the address of the next member due to receive a payout, so that the UI can display who is next and the executePayout function can target the correct recipient.

#### Acceptance Criteria

1. WHEN `payoutApi.getNextRecipient` is called with a valid `groupId` (string), THE `PayoutApi` SHALL convert `groupId` to `bigint` and call `ContractClient.getPayoutSchedule`.
2. WHEN the schedule is retrieved, THE `PayoutApi` SHALL iterate through the schedule entries in order and call `ContractClient.hasReceivedPayout` for each entry until the first entry where `hasReceivedPayout` returns `false` is found.
3. WHEN the first unpaid entry is found, THE `PayoutApi` SHALL return the `recipient` address from that entry as a `string`.
4. IF all entries in the schedule have `hasReceivedPayout` returning `true`, THEN THE `PayoutApi` SHALL return `null` to indicate no pending recipient.
5. IF the payout schedule is empty, THEN THE `PayoutApi` SHALL return `null`.
6. IF a `ContractError` is thrown during any contract read, THEN THE `PayoutApi` SHALL re-throw it unchanged.

---

### Requirement 5: Consistent Error Handling

**User Story:** As a frontend developer, I want all errors from `payoutApi` functions to be `ContractError` instances, so that error handling in hooks and components is uniform.

#### Acceptance Criteria

1. WHEN any `PayoutApi` function catches a thrown value that is already a `ContractError`, THE `PayoutApi` SHALL re-throw it unchanged without double-wrapping.
2. WHEN any `PayoutApi` function catches a non-`ContractError` value, THE `PayoutApi` SHALL pass it through `parseContractError` and re-throw the resulting `ContractError`.
3. THE `PayoutApi` SHALL NOT swallow errors silently; every caught error SHALL result in a thrown `ContractError`.
4. THE `PayoutApi` SHALL NOT expose raw `Record<string, unknown>` or untyped `unknown` values in any public function signature.

---

### Requirement 6: Domain Type Mapping

**User Story:** As a frontend developer, I want all `payoutApi` functions to return properly typed domain objects using the existing `PayoutEntry`, `PayoutQueueData`, and `PayoutStatus` types, so that I get compile-time safety and IDE autocompletion when consuming payout data.

#### Acceptance Criteria

1. THE `PayoutApi` SHALL use the `PayoutEntry` interface from `frontend/src/types/contribution.ts` for all individual payout record return values.
2. THE `PayoutApi` SHALL use the `PayoutQueueData` interface from `frontend/src/types/contribution.ts` as the return type of `getPayoutQueue`.
3. THE `PayoutApi` SHALL use the `PayoutStatus` type from `frontend/src/types/contribution.ts` for the `status` field of each `PayoutEntry`.
4. WHEN mapping contract data to domain types, THE `PayoutApi` SHALL convert all `bigint` monetary values from stroops to XLM by dividing by `10_000_000`.
5. WHEN mapping contract data to domain types, THE `PayoutApi` SHALL convert all `bigint` Unix timestamps to JavaScript `Date` objects by multiplying by `1000n` and passing to `new Date(Number(...))`.
6. THE `PayoutApi` SHALL NOT export `Record<string, unknown>` or raw contract response types as part of its public API surface.
