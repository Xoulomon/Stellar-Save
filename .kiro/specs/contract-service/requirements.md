# Requirements Document

## Introduction

This feature introduces a `ContractService` class as a dedicated service layer for all Soroban smart contract interactions in the StellarSave frontend. It sits between the low-level `contractClient` (which handles XDR encoding, transaction building, Freighter signing, and RPC submission) and the React hooks/components that consume contract data.

The service consolidates contract interaction logic into a single, testable, typed class, provides a clean API surface with rich TypeScript types, normalises raw contract responses into domain objects, and centralises error parsing. It also replaces the stub implementations in `groupApi.ts` with real contract invocations routed through the service.

## Glossary

- **ContractService**: The new OOP service class defined in `frontend/src/services/contractService.ts` that wraps all contract interactions.
- **ContractClient**: The existing low-level module at `frontend/src/lib/contractClient.ts` that handles XDR, transaction building, Freighter signing, and RPC submission.
- **ContractError**: The typed error class exported by `ContractClient` that carries a numeric error code and a human-readable message.
- **Domain_Type**: A TypeScript interface or type that represents a business-level concept (e.g. `GroupDetail`, `MemberInfo`, `PayoutScheduleEntry`) as opposed to a raw `Record<string, unknown>` returned by the RPC.
- **Mutation**: A contract call that writes state on-chain and requires wallet signing (e.g. `createGroup`, `contribute`).
- **Query**: A read-only contract call that does not require wallet signing (e.g. `getGroup`, `getMemberCount`).
- **Stroops**: The smallest unit of XLM (1 XLM = 10,000,000 stroops), used internally by the contract.
- **Freighter**: The Stellar browser wallet extension used to sign transactions.
- **RPC_Node**: The Soroban RPC endpoint configured via `VITE_STELLAR_RPC_URL`.
- **groupApi**: The existing stub utility at `frontend/src/utils/groupApi.ts` whose TODO stubs will be replaced by `ContractService` calls.

---

## Requirements

### Requirement 1: ContractService Class Structure

**User Story:** As a frontend developer, I want a single `ContractService` class that encapsulates all contract interactions, so that I have one authoritative place to find, test, and modify contract method signatures.

#### Acceptance Criteria

1. THE `ContractService` SHALL be defined as a TypeScript class exported from `frontend/src/services/contractService.ts`.
2. THE `ContractService` SHALL accept an optional configuration object at construction time that allows overriding the `ContractClient` dependency, so that tests can inject a mock.
3. THE `ContractService` SHALL expose all Mutation methods and all Query methods defined in `ContractClient` as public instance methods.
4. THE `ContractService` SHALL be instantiable without arguments, defaulting to the real `ContractClient` functions.
5. THE `ContractService` SHALL export a singleton instance as the default export so that consumers can import it directly without constructing it.

---

### Requirement 2: TypeScript Domain Types

**User Story:** As a frontend developer, I want strongly-typed return values from every `ContractService` method, so that I get compile-time safety and IDE autocompletion when working with contract data.

#### Acceptance Criteria

1. THE `ContractService` SHALL define or import a `GroupInfo` interface that maps all fields returned by the `get_group` contract method to named, typed properties (no `Record<string, unknown>` in the public API).
2. THE `ContractService` SHALL define or import a `MemberInfo` interface with fields: `address: string`, `payoutPosition: number`, `hasReceivedPayout: boolean`, `totalContributions: bigint`.
3. THE `ContractService` SHALL define or import a `PayoutScheduleEntry` interface with fields: `recipient: string`, `cycle: number`, `payoutDate: bigint`.
4. THE `ContractService` SHALL define or import a `ContractServiceConfig` interface describing the optional constructor configuration.
5. WHEN a Query method returns a collection, THE `ContractService` SHALL type the return value as a typed array (e.g. `PayoutScheduleEntry[]`) rather than `unknown[]`.
6. THE `ContractService` SHALL export all Domain_Types so that hooks and components can import them without depending on `ContractClient` directly.

---

### Requirement 3: Group Mutation Methods

**User Story:** As a frontend developer, I want `ContractService` to expose all group write operations with wallet-address injection, so that callers do not need to pass the signer address manually.

#### Acceptance Criteria

1. WHEN `ContractService.createGroup` is called with `contributionAmount`, `cycleDuration`, and `maxMembers`, THE `ContractService` SHALL invoke `ContractClient.createGroup` with the caller's address injected as `creator` and SHALL return the new group ID as `bigint`.
2. WHEN `ContractService.joinGroup` is called with `groupId`, THE `ContractService` SHALL invoke `ContractClient.joinGroup` with the caller's address injected as `member` and SHALL return the transaction hash as `string`.
3. WHEN `ContractService.contribute` is called with `groupId` and `amount`, THE `ContractService` SHALL invoke `ContractClient.contribute` with the caller's address injected as `member` and SHALL return the transaction hash as `string`.
4. WHEN `ContractService.activateGroup` is called with `groupId`, THE `ContractService` SHALL invoke `ContractClient.activateGroup` with the caller's address injected as `creator` and SHALL return the transaction hash as `string`.
5. WHEN `ContractService.executePayout` is called with `groupId`, THE `ContractService` SHALL invoke `ContractClient.executePayout` with the caller's address injected as `recipient` and SHALL return the transaction hash as `string`.
6. WHEN `ContractService.pauseGroup` is called with `groupId`, THE `ContractService` SHALL invoke `ContractClient.pauseGroup` with the caller's address injected as `caller` and SHALL return the transaction hash as `string`.
7. WHEN `ContractService.resumeGroup` is called with `groupId`, THE `ContractService` SHALL invoke `ContractClient.resumeGroup` with the caller's address injected as `caller` and SHALL return the transaction hash as `string`.
8. IF a Mutation method is called without a `callerAddress` being set on the service instance, THEN THE `ContractService` SHALL throw a `ContractError` with the message `"Wallet is not connected."`.

---

### Requirement 4: Group Query Methods

**User Story:** As a frontend developer, I want `ContractService` to expose all read-only contract queries with typed return values, so that I can fetch on-chain data without dealing with raw XDR or `Record<string, unknown>`.

#### Acceptance Criteria

1. WHEN `ContractService.getGroup` is called with a `groupId`, THE `ContractService` SHALL invoke `ContractClient.getGroup` and SHALL return a `GroupInfo` object with all fields mapped from the raw contract response.
2. WHEN `ContractService.listGroups` is called with `cursor`, `limit`, and an optional `statusFilter`, THE `ContractService` SHALL invoke `ContractClient.listGroups` and SHALL return a `GroupInfo[]` array.
3. WHEN `ContractService.getTotalGroups` is called, THE `ContractService` SHALL invoke `ContractClient.getTotalGroups` and SHALL return a `bigint`.
4. WHEN `ContractService.getMemberCount` is called with `groupId`, THE `ContractService` SHALL invoke `ContractClient.getMemberCount` and SHALL return a `number`.
5. WHEN `ContractService.getPayoutPosition` is called with `groupId` and `memberAddress`, THE `ContractService` SHALL invoke `ContractClient.getPayoutPosition` and SHALL return a `number`.
6. WHEN `ContractService.hasReceivedPayout` is called with `groupId` and `memberAddress`, THE `ContractService` SHALL invoke `ContractClient.hasReceivedPayout` and SHALL return a `boolean`.
7. WHEN `ContractService.getMemberTotalContributions` is called with `groupId` and `memberAddress`, THE `ContractService` SHALL invoke `ContractClient.getMemberTotalContributions` and SHALL return a `bigint`.
8. WHEN `ContractService.getGroupBalance` is called with `groupId`, THE `ContractService` SHALL invoke `ContractClient.getGroupBalance` and SHALL return a `bigint`.
9. WHEN `ContractService.getPayoutSchedule` is called with `groupId`, THE `ContractService` SHALL invoke `ContractClient.getPayoutSchedule` and SHALL return a `PayoutScheduleEntry[]`.
10. WHEN `ContractService.getContributionDeadline` is called with `groupId` and `cycleNumber`, THE `ContractService` SHALL invoke `ContractClient.getContributionDeadline` and SHALL return a `bigint` representing the Unix timestamp of the deadline.
11. WHEN `ContractService.isCycleComplete` is called with `groupId` and `cycleNumber`, THE `ContractService` SHALL invoke `ContractClient.isCycleComplete` and SHALL return a `boolean`.
12. WHEN `ContractService.isPayoutDue` is called with `groupId`, THE `ContractService` SHALL invoke `ContractClient.isPayoutDue` and SHALL return a `boolean`.

---

### Requirement 5: Error Handling and Parsing

**User Story:** As a frontend developer, I want all contract errors to be normalised into a consistent `ContractError` shape before they reach the UI, so that error handling in hooks and components is uniform and predictable.

#### Acceptance Criteria

1. WHEN any `ContractService` method catches a thrown value, THE `ContractService` SHALL pass it through `ContractClient.parseContractError` and re-throw the resulting `ContractError`.
2. WHEN a `ContractError` is thrown by `ContractClient`, THE `ContractService` SHALL re-throw it unchanged without double-wrapping.
3. WHEN a network-level error (non-`ContractError`) is caught, THE `ContractService` SHALL produce a `ContractError` with `code: null` and a message derived from the original error's `message` property.
4. THE `ContractService` SHALL NOT swallow errors silently; every caught error SHALL result in a thrown `ContractError`.
5. WHEN `ContractService.parseError` is called with any value, THE `ContractService` SHALL return a `ContractError` using the same logic as `ContractClient.parseContractError`, providing a single entry point for error normalisation across the app.

---

### Requirement 6: Wallet Address Management

**User Story:** As a frontend developer, I want to set the active wallet address on the service once (e.g. when the wallet connects), so that I don't have to pass it to every mutation call.

#### Acceptance Criteria

1. THE `ContractService` SHALL expose a `setCallerAddress(address: string | null): void` method that stores the active wallet address for use in subsequent Mutation calls.
2. WHEN `setCallerAddress` is called with a valid Stellar address string, THE `ContractService` SHALL use that address for all subsequent Mutation calls until `setCallerAddress` is called again.
3. WHEN `setCallerAddress` is called with `null`, THE `ContractService` SHALL clear the stored address so that subsequent Mutation calls throw `"Wallet is not connected."`.
4. THE `ContractService` SHALL expose a `getCallerAddress(): string | null` getter that returns the currently stored address.

---

### Requirement 7: groupApi Replacement

**User Story:** As a frontend developer, I want the stub functions in `groupApi.ts` to be replaced with real `ContractService` calls, so that the app fetches live on-chain data instead of mock data.

#### Acceptance Criteria

1. WHEN `groupApi.fetchGroups` is called, THE `groupApi` SHALL delegate to `ContractService.listGroups` with a default cursor of `0n` and a reasonable default page size, and SHALL return a `PublicGroup[]` mapped from the `GroupInfo[]` result.
2. WHEN `groupApi.fetchGroup` is called with a `groupId`, THE `groupApi` SHALL delegate to `ContractService.getGroup` and SHALL return a `DetailedGroup` mapped from the `GroupInfo` result.
3. WHEN `groupApi.createGroup` is called with group parameters, THE `groupApi` SHALL delegate to `ContractService.createGroup` and SHALL return the new group ID as a `string`.
4. IF `ContractService` throws a `ContractError` during a `groupApi` call, THEN THE `groupApi` SHALL re-throw the error so that callers receive a typed error.

---

### Requirement 8: Unit Testability

**User Story:** As a developer, I want `ContractService` to be fully unit-testable with a mock `ContractClient`, so that I can verify service logic without hitting the Stellar network.

#### Acceptance Criteria

1. THE `ContractService` SHALL accept a `ContractClientDependencies` object at construction time that replaces the real `ContractClient` functions with test doubles.
2. WHEN constructed with mock dependencies, THE `ContractService` SHALL call only the injected mock functions and SHALL NOT import or invoke the real `ContractClient` functions.
3. THE `ContractService` SHALL expose a stable, documented interface (via TypeScript types) for the `ContractClientDependencies` injection shape so that test authors know exactly what to mock.
4. FOR ALL Query methods, calling the method on a `ContractService` instance constructed with a mock that returns a fixed value SHALL return that same fixed value after domain mapping.
5. FOR ALL Mutation methods, calling the method on a `ContractService` instance constructed with a mock that resolves to a fixed `txHash` SHALL return that same `txHash`.
