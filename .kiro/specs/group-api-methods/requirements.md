# Requirements Document

## Introduction

This feature replaces the stub implementations in `frontend/src/utils/groupApi.ts` with production-ready API methods that delegate to the Soroban smart contract via `ContractService` (or directly via `contractClient`). The API layer provides typed, domain-level functions for group operations — `createGroup`, `getGroup`, `listGroups`, `joinGroup`, and a gracefully-handled `leaveGroup` — along with consistent error handling using `ContractError` / `parseContractError`. The resulting functions are designed to be consumed directly by React hooks and components without any raw XDR or `Record<string, unknown>` leaking into the UI layer.

## Glossary

- **GroupApi**: The module at `frontend/src/utils/groupApi.ts` that exposes high-level async functions for group operations.
- **ContractService**: The typed service class defined in `frontend/src/services/contractService.ts` (spec #366) that wraps `ContractClient` with domain mapping and error normalisation.
- **ContractClient**: The existing low-level module at `frontend/src/lib/contractClient.ts` that handles XDR encoding, transaction building, Freighter signing, and RPC submission.
- **ContractError**: The typed error class exported by `ContractClient` carrying a numeric `code` and a human-readable `message`.
- **PublicGroup**: The existing TypeScript interface in `frontend/src/types/group.ts` representing a summary-level group as shown in list views.
- **GroupDetail**: The existing TypeScript interface in `frontend/src/types/group.ts` representing a fully-detailed group as shown in the detail view.
- **GroupData**: The input shape for `createGroup`, containing `contributionAmount`, `cycleDuration`, `maxMembers`, and `minMembers`.
- **Stroops**: The smallest unit of XLM (1 XLM = 10,000,000 stroops), used internally by the contract for all monetary values.
- **Freighter**: The Stellar browser wallet extension used to sign transactions.
- **leaveGroup**: A group-exit operation that has no corresponding on-chain method in the current contract version.
- **Cursor**: A `bigint` offset used for paginated `listGroups` queries.

---

## Requirements

### Requirement 1: Replace createGroup Stub

**User Story:** As a frontend developer, I want `groupApi.createGroup` to invoke the real contract, so that new groups are actually created on-chain rather than returning a mock ID.

#### Acceptance Criteria

1. WHEN `groupApi.createGroup` is called with a valid `GroupData` object, THE `GroupApi` SHALL delegate to `ContractService.createGroup` (or `ContractClient.createGroup`) with `contributionAmount` converted from XLM to stroops, `cycleDuration` in seconds, and `maxMembers` as provided.
2. WHEN the contract call succeeds, THE `GroupApi` SHALL return the new group ID as a `string`.
3. IF `ContractService` throws a `ContractError` during group creation, THEN THE `GroupApi` SHALL re-throw the `ContractError` unchanged so that callers receive a typed error.
4. IF `groupApi.createGroup` is called without a connected wallet address being available, THEN THE `GroupApi` SHALL throw a `ContractError` with the message `"Wallet is not connected."`.
5. THE `GroupApi` SHALL NOT return mock or hardcoded data from `createGroup`.

---

### Requirement 2: Replace getGroup Stub

**User Story:** As a frontend developer, I want `groupApi.fetchGroup` to return live on-chain data, so that the group detail view reflects the actual contract state.

#### Acceptance Criteria

1. WHEN `groupApi.fetchGroup` is called with a `groupId` string, THE `GroupApi` SHALL convert the `groupId` to `bigint` and delegate to `ContractService.getGroup` (or `ContractClient.getGroup`).
2. WHEN the contract call succeeds, THE `GroupApi` SHALL map the raw contract response to a `GroupDetail` object with all fields populated from on-chain data.
3. THE mapped `GroupDetail` SHALL include at minimum: `id`, `name`, `memberCount`, `contributionAmount` (converted from stroops to XLM), `status`, `createdAt`, `creator`, `cycleDuration`, `maxMembers`, `currentCycle`, `isActive`, and `started`.
4. IF the contract returns a group-not-found error (code `1001`), THEN THE `GroupApi` SHALL re-throw the `ContractError` so the caller can display an appropriate not-found message.
5. IF any other `ContractError` is thrown, THEN THE `GroupApi` SHALL re-throw it unchanged.
6. THE `GroupApi` SHALL NOT return mock or hardcoded data from `fetchGroup`.

---

### Requirement 3: Replace listGroups Stub

**User Story:** As a frontend developer, I want `groupApi.fetchGroups` to return live on-chain group listings, so that the browse-groups page shows real data.

#### Acceptance Criteria

1. WHEN `groupApi.fetchGroups` is called, THE `GroupApi` SHALL delegate to `ContractService.listGroups` (or `ContractClient.listGroups`) with a default cursor of `0n` and a configurable default page size (minimum 20).
2. WHEN `groupApi.fetchGroups` is called with optional `cursor` and `limit` parameters, THE `GroupApi` SHALL forward those values to the contract call.
3. WHEN the contract call succeeds, THE `GroupApi` SHALL map each raw contract group record to a `PublicGroup` object with all fields populated from on-chain data.
4. THE mapped `PublicGroup` SHALL include at minimum: `id`, `name`, `memberCount`, `contributionAmount` (converted from stroops to XLM), `currency` (always `"XLM"`), `status`, and `createdAt`.
5. WHEN the contract returns an empty list, THE `GroupApi` SHALL return an empty array `[]`.
6. IF a `ContractError` is thrown during the call, THEN THE `GroupApi` SHALL re-throw it unchanged.
7. THE `GroupApi` SHALL NOT return mock or hardcoded data from `fetchGroups`.

---

### Requirement 4: Implement joinGroup

**User Story:** As a frontend developer, I want a `groupApi.joinGroup` function that submits a real on-chain join transaction, so that users can join savings groups from the UI.

#### Acceptance Criteria

1. WHEN `groupApi.joinGroup` is called with a `groupId` string, THE `GroupApi` SHALL convert the `groupId` to `bigint` and delegate to `ContractService.joinGroup` (or `ContractClient.joinGroup`) with the active wallet address injected as `member`.
2. WHEN the transaction is confirmed, THE `GroupApi` SHALL return the transaction hash as a `string`.
3. IF the group is full (contract error code `1002`), THEN THE `GroupApi` SHALL re-throw the `ContractError` so the caller can display a "group is full" message.
4. IF the caller is already a member (contract error code `2001`), THEN THE `GroupApi` SHALL re-throw the `ContractError` so the caller can display an "already a member" message.
5. IF `groupApi.joinGroup` is called without a connected wallet, THEN THE `GroupApi` SHALL throw a `ContractError` with the message `"Wallet is not connected."`.
6. IF any other `ContractError` is thrown, THEN THE `GroupApi` SHALL re-throw it unchanged.

---

### Requirement 5: Handle leaveGroup Gracefully

**User Story:** As a frontend developer, I want a `groupApi.leaveGroup` function that handles the absence of an on-chain leave method gracefully, so that the UI can communicate the limitation clearly without crashing.

#### Acceptance Criteria

1. THE `GroupApi` SHALL export a `leaveGroup` function that accepts a `groupId` string parameter.
2. WHEN `groupApi.leaveGroup` is called, THE `GroupApi` SHALL throw a `ContractError` with `code: null` and the message `"Leaving a group is not supported by the current contract version."`.
3. THE `GroupApi` SHALL NOT attempt to call any contract method for `leaveGroup`.
4. THE `GroupApi` SHALL document in a code comment that `leaveGroup` is unsupported on-chain and that this requirement should be revisited when the contract adds a `leave_group` method.

---

### Requirement 6: Consistent Error Handling

**User Story:** As a frontend developer, I want all errors from `groupApi` functions to be `ContractError` instances, so that error handling in hooks and components is uniform.

#### Acceptance Criteria

1. WHEN any `GroupApi` function catches a thrown value that is already a `ContractError`, THE `GroupApi` SHALL re-throw it unchanged without double-wrapping.
2. WHEN any `GroupApi` function catches a non-`ContractError` value, THE `GroupApi` SHALL pass it through `parseContractError` and re-throw the resulting `ContractError`.
3. THE `GroupApi` SHALL NOT swallow errors silently; every caught error SHALL result in a thrown `ContractError`.
4. THE `GroupApi` SHALL NOT expose raw `Record<string, unknown>` or untyped `unknown` values in any public function signature.

---

### Requirement 7: Domain Type Mapping

**User Story:** As a frontend developer, I want all `groupApi` functions to return properly typed domain objects, so that I get compile-time safety and IDE autocompletion when consuming group data.

#### Acceptance Criteria

1. THE `GroupApi` SHALL return `PublicGroup` objects from `fetchGroups`, with `contributionAmount` expressed in XLM (not stroops).
2. THE `GroupApi` SHALL return `GroupDetail` objects from `fetchGroup`, with `contributionAmount` expressed in XLM (not stroops).
3. THE `GroupApi` SHALL return a `string` group ID from `createGroup`.
4. THE `GroupApi` SHALL return a `string` transaction hash from `joinGroup`.
5. WHEN mapping contract data to domain types, THE `GroupApi` SHALL convert all `bigint` monetary values from stroops to XLM by dividing by `10_000_000`.
6. WHEN mapping contract data to domain types, THE `GroupApi` SHALL convert all `bigint` Unix timestamps to JavaScript `Date` objects.
7. THE `GroupApi` SHALL NOT export `Record<string, unknown>` or raw contract response types as part of its public API surface.

---

### Requirement 8: Backward Compatibility

**User Story:** As a frontend developer, I want the updated `groupApi` to preserve the existing function signatures, so that existing hooks and components that call `groupApi` do not need to be updated.

#### Acceptance Criteria

1. THE `GroupApi` SHALL preserve the existing exported function names: `createGroup`, `fetchGroups`, `fetchGroup`.
2. THE `GroupApi` SHALL preserve the existing `GroupData` input interface for `createGroup`.
3. THE `GroupApi` SHALL preserve the existing `PublicGroup` and `DetailedGroup` / `GroupDetail` return types for `fetchGroups` and `fetchGroup` respectively.
4. THE `GroupApi` SHALL add `joinGroup` and `leaveGroup` as new exports without removing any existing exports.
5. WHEN `fetchGroups` is called with no arguments, THE `GroupApi` SHALL behave identically to the previous stub signature (no required parameters).
