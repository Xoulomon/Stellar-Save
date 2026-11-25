## Summary

This PR resolves four frontend maintenance issues: image/asset optimization and lazy loading, debouncing with stale-request cancellation, a single transaction-signing module, and a container/presentational split of the group dashboards. All changes are backwards compatible; existing imports, default exports, route shapes, and public APIs are preserved.

Closes #2040
Closes #2041
Closes #2042
Closes #2043

## Type of change

- [x] `fix` — bug fix (stale responses, broken analytics contract, broken image fallbacks)
- [x] `refactor` — code restructuring, no behavior change to public APIs
- [x] `perf` — performance improvement (lazy loading, debounce, request cancellation)
- [x] `test` — tests added or updated
- [ ] Breaking change

## Changes

### #2043 — Image/asset optimization and lazy loading (`frontend/src/assets`)

**Before:** no `frontend/src/assets` module; asset imports scattered across two directories and two page files; four independent image-rendering approaches (MUI `Box component="img"`, plain `<img>`, canvas/QR loader, manual error state); no lazy loading, async decoding or intrinsic dimensions on group images; no error fallback outside `Avatar`; one narrow imagetools type declaration.

**After:**
- Added `src/assets/illustrations.ts` — single registry for both illustrations with alt text, intrinsic width/height (prevents CLS) and the WebP source.
- Added `src/assets/OptimizedImage.tsx` — reusable image with `loading="lazy"`, `decoding="async"`, `<picture>`/`<source>` support, intrinsic dimensions and primary/fallback error handling.
- Added `src/assets/index.ts` barrel and generalized `vite-imagetools.d.ts` query typings.
- Migrated `ErrorPage`, `NotFoundPage`, `GroupCardHeader` and `GroupList` to the shared component, removing duplicated image markup.

### #2042 — Debounce and cancel stale network requests (`frontend/src/hooks`)

**Before:** two ~85-line copies of debounce logic in `useDebounce.ts`; `cancel` identity changed on every render; leading-edge behavior did not update on subsequent changes; four competing stale-response idioms (`fetchIdRef`, `isCancelled`, `isMountedRef`, React Query keys); `usePayouts` catch block was unguarded; `useActivityFeed.loadMore` had no stale guard; no `AbortSignal` plumbing.

**After:**
- Unified both debounce hooks on one internal `useDebounceState`; `cancel` is now stable via `useCallback` and also clears the leading timer; leading updates now apply on every change; fixed the pre-existing leading-edge test.
- Added `useCancellableRequest` with per-lane request IDs, `AbortSignal`, `abort()`/`cancel()` and unmount invalidation; exported from `hooks/index.ts`.
- Migrated `useActivityFeed` (separate `load`/`loadMore` lanes), `useMembers` and `usePayouts`, removing all three duplicated `fetchIdRef` blocks and guarding the previously unguarded `usePayouts` catch.

### #2041 — Consolidate transaction-signing flow into one module (`frontend/src/services`)

**Before:** no single signing module; `transactionBuilderService.ts` only built/simulated and never signed; signing lived in a private `contractClient.signAndSubmit`, in the wallet kit provider, and in hardware adapters; network passphrase, dummy address, build boilerplate and Freighter response normalization duplicated across modules; no services barrel.

**After:**
- Added `src/services/transactionSigningService.ts` owning `NETWORK_PASSPHRASE`, `DUMMY_ADDRESS`, `buildTransaction`, `TransactionSigner`, `normalizeSignedTransaction` (both string and `{signedTxXdr}`/`{signedTx}` shapes), `signTransactionXdr` and `createFreighterSigner`.
- `transactionBuilderService.ts` and `lib/contractClient.ts` now delegate to those primitives; all existing export names and signatures are unchanged.
- Added `src/services/index.ts` barrel.

### #2040 — Split group dashboards into presentational/container parts (`frontend/src/pages`)

**Before:** `DashboardPage` mixed data hooks and the whole layout in one private component; `GroupAnalytics` mixed `useParams`/`useGroupAnalytics` with inline rendering and consumed a stale `stats`/`history` contract that does not exist on `GroupAnalyticsResult`; broken hook mocks and never-committed snapshots in `DashboardPage.snapshot.test.tsx`.

**After:**
- Added `pages/dashboard/DashboardView.tsx` + barrel — pure props-driven view for the savings/group dashboard.
- Added `pages/group-analytics/GroupAnalyticsView.tsx` + barrel — pure props-driven view using the real hook contract (`cycleRates`, `onTimePercent`, `projectedCompletionDate`).
- Both pages remain route-facing containers with unchanged default exports; the `React.lazy` route shape is untouched.
- Replaced the broken snapshot suite with behavioral container tests and added presentational view tests.

### Tests and tooling

- Added 8 test files / 50 new tests covering optimized images and error fallbacks, cancellable request lanes and unmount invalidation, stable debounce cancel, signer response normalization and failure cases, and both presentational views.
- Added the new modules to `vitest.config.ts` coverage `include` so they are enforced going forward.

## Testing

```bash
cd frontend
npx vitest run src/assets src/hooks src/services src/pages/dashboard \
  src/pages/group-analytics src/test/DashboardPage.snapshot.test.tsx \
  src/test/GroupAnalytics.container.test.tsx src/test/GroupCardHeader.test.tsx
# 21 files passed, 155 tests passed

npx eslint src/assets src/hooks/useCancellableRequest.ts src/hooks/useDebounce.ts \
  src/services/transactionSigningService.ts src/pages/dashboard \
  src/pages/group-analytics src/pages/DashboardPage.tsx src/pages/GroupAnalytics.tsx
# clean
```

Coverage of the new modules: **96.92% lines / 90% branches / 94.73% functions / 96.92% statements** (above the 85% target).

Note: the full frontend suite has pre-existing failures on `main` (102 failing tests caused by `@stellar/freighter-api` CJS interop and unresolved shared-utils exports) and pre-existing TypeScript/ESLint errors in untouched files. No new failures were introduced by this change.

## Checklist

- [x] `npm run lint` equivalent run on all changed files (pre-existing errors in untouched files remain)
- [x] Tests added or updated for new/changed behavior
- [x] No snapshots changed or blindly updated; broken snapshot assertions replaced with behavioral tests
- [x] No secrets or `.env` files staged
- [ ] CI green (blocked by pre-existing failures on `main`)
