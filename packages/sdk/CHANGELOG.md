# Changelog — @stellar-save/sdk

## Unreleased

### Removed (breaking)

Dead exports with no consumers in `frontend/`, `mobile/` or `backend/` were
removed to shrink the published API surface (#1941). Consumers were found by
scanning every import of `@stellar-save/sdk` in the monorepo.

- **API client** (`src/client.ts` deleted): `StellarSaveApiClient`,
  `createApiClient`, `ApiClientConfig`, `ApiError`.
- **Contract helpers** (`src/contract.ts`): `ContractError`,
  `parseContractError`, `CONTRACT_ERROR_MESSAGES`, `ContractFunction`. The
  frontend keeps its own implementations in `frontend/src/lib/client.ts`.
- **`CONTRACT_FUNCTIONS`** is no longer exported from the package entry point.
  It stays in `src/contract.ts` (marked `@internal`) only for the
  `pnpm check:abi` drift test.
- **RPC cache** (`src/rpcBatchCache.ts` deleted, never exported from the
  entry point): `cache`, `getCachedLedgerEntry`, `getCachedContractData`,
  `accountBatcher`, `getCacheStats`.
- **Types**: `Group`, `GroupFilters`, `GroupMember`, `Contribution`,
  `ContributionStatus`, `Payout`, `ServiceCost`, `OptimizationRecommendation`,
  `CostReport`, `PaginatedResponse`.

### Kept

Formatting and validation utilities (`formatAmount`, `formatStroops`,
`formatAddress`, `validateAddress`, `isValidStellarAddress`, `formatDate`,
`formatDistanceToNow` and their option/result types) and the types
`GroupStatus`, `MemberStatus`, `PayoutStatus`, `TransactionType`,
`Transaction` and `PaginationMeta`.
