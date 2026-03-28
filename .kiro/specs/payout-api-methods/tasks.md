# Implementation Plan: payout-api-methods

## Overview

Implement `frontend/src/utils/payoutApi.ts` as a thin orchestration layer over `contractClient.ts`, exposing four async functions with typed domain objects and uniform `ContractError` error handling. Tests live in `frontend/src/test/payoutApi.test.ts` using Vitest + fast-check.

## Tasks

- [x] 1. Create `payoutApi.ts` module skeleton and type imports
  - Create `frontend/src/utils/payoutApi.ts`
  - Import `PayoutEntry`, `PayoutQueueData`, `PayoutStatus` from `../types/contribution`
  - Import `ContractError`, `parseContractError`, `PayoutScheduleEntry`, and all required contract functions from `../lib/contractClient`
  - Export the four function stubs with correct signatures: `executePayout`, `getPayoutQueue`, `getPayoutHistory`, `getNextRecipient`
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 6.1, 6.2, 6.3_

- [x] 2. Implement `getNextRecipient`
  - [x] 2.1 Implement `getNextRecipient(groupId: string): Promise<string | null>`
    - Convert `groupId` to `bigint` with `BigInt(groupId)`
    - Call `getPayoutSchedule(groupId)` and iterate entries in order
    - For each entry call `hasReceivedPayout`; return the first `recipient` where it returns `false`
    - Return `null` if schedule is empty or all entries are paid
    - Wrap body in try/catch re-throwing via `parseContractError`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2_

  - [ ]* 2.2 Write property test for `getNextRecipient` — Property 6: first unpaid recipient
    - **Property 6: getNextRecipient returns first unpaid recipient**
    - **Validates: Requirements 4.2, 4.3**
    - Use `fc.array(scheduleEntryArb)` with paired `fc.array(fc.boolean())` paid-flags
    - Assert returned address equals the recipient at the lowest index where paid flag is `false`

  - [ ]* 2.3 Write unit tests for `getNextRecipient` edge cases
    - Empty schedule → `null`
    - All paid → `null`
    - First entry unpaid → returns its recipient
    - _Requirements: 4.4, 4.5_

- [x] 3. Implement `executePayout`
  - [x] 3.1 Implement `executePayout(groupId: string, callerAddress: string): Promise<string>`
    - Guard: throw `new ContractError(null, 'Wallet is not connected.')` if `callerAddress` is falsy
    - Call `getNextRecipient(groupId)`; throw `new ContractError(null, 'No eligible recipient found for payout.')` if result is `null`
    - Delegate to `contractClient.executePayout({ groupId: BigInt(groupId), recipient })`
    - Return the transaction hash string
    - Wrap body in try/catch re-throwing via `parseContractError`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 5.1, 5.2_

  - [ ]* 3.2 Write unit tests for `executePayout` guards
    - Empty `callerAddress` → throws `ContractError` with message `"Wallet is not connected."`
    - `getNextRecipient` returns `null` → throws `ContractError` with message `"No eligible recipient found for payout."`
    - Contract throws error code `4002` → re-thrown unchanged
    - Contract throws error code `4003` → re-thrown unchanged
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

- [x] 4. Implement `getPayoutHistory`
  - [x] 4.1 Implement `getPayoutHistory(groupId: string): Promise<PayoutEntry[]>`
    - Convert `groupId` to `bigint`
    - Call `getPayoutSchedule`; return `[]` for empty schedule
    - Call `hasReceivedPayout` for each entry; keep only entries where it returns `true`
    - Map each kept entry to `PayoutEntry` with `status: 'completed'`, `paidAt: new Date(Number(entry.payout_date * 1000n))`, `estimatedDate` from same timestamp, `position` as 1-based index in full schedule
    - Add code comment: `// paidAt is derived from the scheduled payout_date, not an actual on-chain event timestamp`
    - Wrap body in try/catch re-throwing via `parseContractError`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 5.2, 6.1, 6.3, 6.4, 6.5_

  - [ ]* 4.2 Write property test for `getPayoutHistory` — Property 7: filters to completed entries only
    - **Property 7: getPayoutHistory filters to completed entries only**
    - **Validates: Requirements 3.3**
    - Use `fc.array(scheduleEntryArb)` with paired paid-flags
    - Assert returned array length equals count of `true` flags and every entry has `status: 'completed'` and `paidAt` set

  - [ ]* 4.3 Write property test for timestamp conversion — Property 8: timestamp round-trip
    - **Property 8: Timestamp conversion round-trip**
    - **Validates: Requirements 3.3, 6.5**
    - Use `fc.bigInt({ min: 0n, max: 9999999999n })`
    - Assert `new Date(Number(ts * 1000n)).getTime() === Number(ts) * 1000`

  - [ ]* 4.4 Write unit tests for `getPayoutHistory` edge cases
    - Empty schedule → `[]`
    - No paid members → `[]`
    - _Requirements: 3.4_

- [x] 5. Implement `getPayoutQueue`
  - [x] 5.1 Implement `getPayoutQueue(groupId: string, currentUserAddress?: string): Promise<PayoutQueueData>`
    - Convert `groupId` to `bigint`
    - Call `getPayoutSchedule` and `getMemberCount` in parallel via `Promise.all`
    - Return `{ cycleId: 0, totalMembers: 0, entries: [] }` for empty schedule
    - Call `hasReceivedPayout` for all entries (can be parallelised with `Promise.all`)
    - Assign `PayoutStatus`: `'completed'` for paid entries, `'next'` for the first unpaid, `'upcoming'` for subsequent unpaid
    - Derive `amount` per entry: call `getGroupBalance` then `Number(balance) / totalMembers / 10_000_000`
    - Set `cycleId` to the `cycle` field of the first `'next'` entry, or `0` if all completed
    - Include `currentUserAddress` in the returned object if provided
    - Wrap body in try/catch re-throwing via `parseContractError`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 5.1, 5.2, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 5.2 Write property test for `getPayoutQueue` — Property 4: PayoutStatus assignment correctness
    - **Property 4: PayoutStatus assignment correctness**
    - **Validates: Requirements 2.3**
    - Use `fc.array(fc.boolean())` as paid-flags for a generated schedule
    - Assert exactly zero or one `'next'` entry, all paid entries are `'completed'`, all post-next unpaid entries are `'upcoming'`

  - [ ]* 5.3 Write property test for `getPayoutQueue` — Property 5: amount conversion invariant
    - **Property 5: Amount conversion invariant**
    - **Validates: Requirements 2.4, 6.4**
    - Use `fc.bigInt({ min: 0n })` for balance and `fc.integer({ min: 1 })` for member count
    - Assert each entry's `amount === Number(balance) / totalMembers / 10_000_000`

  - [ ]* 5.4 Write unit test for `getPayoutQueue` empty schedule
    - Empty schedule → `{ totalMembers: 0, entries: [] }`
    - _Requirements: 2.6_

- [x] 6. Write error-handling property tests
  - [ ]* 6.1 Write property test — Property 1: ContractError pass-through
    - **Property 1: ContractError pass-through**
    - **Validates: Requirements 1.5, 1.6, 1.7, 2.7, 3.6, 4.6, 5.1**
    - Use `fc.record({ code: fc.option(fc.integer()), message: fc.string() })` to generate `ContractError` instances
    - For each of the four public functions, assert that a thrown `ContractError` is re-thrown with identical `code` and `message`

  - [ ]* 6.2 Write property test — Property 2: Non-ContractError normalisation
    - **Property 2: Non-ContractError normalisation**
    - **Validates: Requirements 5.2**
    - Use `fc.oneof(fc.string(), fc.object(), fc.integer())` as thrown values
    - Assert the caught error is a `ContractError` instance

  - [ ]* 6.3 Write property test — Property 3: hasReceivedPayout call count
    - **Property 3: hasReceivedPayout called for every schedule entry**
    - **Validates: Requirements 2.2, 3.2, 4.2**
    - Use `fc.array(scheduleEntryArb)` to generate schedules of length N
    - Assert `hasReceivedPayout` mock was called exactly N times for `getPayoutQueue` and `getPayoutHistory`, and at most N times for `getNextRecipient`

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Run: `cd frontend && npx vitest run src/test/payoutApi.test.ts`

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All `contractClient` functions are mocked via `vi.mock('../lib/contractClient')` in the test file
- Property tests use a minimum of 100 iterations each
- `getNextRecipient` is implemented first because `executePayout` depends on it
