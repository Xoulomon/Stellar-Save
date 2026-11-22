# Changelog — @stellar-save/shared-utils

## Unreleased

### Removed (breaking)

Dead exports with no consumers in the monorepo were removed (#1941). The only
consumer, `backend/src/ipfs/client.ts`, uses `withRetry`.

- **Formatting** (`src/formatting.ts` deleted): `truncateAddress`,
  `formatDate`, `formatRelativeTime`, `formatCurrency`, `formatNumber`,
  `formatPercent`. Use the equivalents in `@stellar-save/sdk`.
- **Validation** (`src/validation.ts` deleted): `STELLAR_ADDRESS_REGEX`,
  `isValidStellarAddress`, `isValidEmail`, `clampLimit`, `clampOffset`,
  `isPositiveNumber`.
- **Retry**: `isTransientHttpError` (no callers). `computeBackoffDelay` is no
  longer exported from the package entry point; it stays exported from
  `src/retry.ts` (marked `@internal`) for its unit tests.

### Kept

`withRetry` and its `RetryOptions` parameter type.
