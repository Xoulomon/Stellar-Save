# Changelog — frontend

All notable changes to the `stellar-save-frontend` package are documented here.
This file follows the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
format. Versions align with `frontend/package.json` and correspond to Git tags
prefixed with `frontend/`.

> **Auto-generation note:** Starting with v0.2.0 this file will be updated
> automatically on every tagged release by `.github/workflows/changelog.yml`.
> Until then, entries are backfilled manually.

---

## [Unreleased]

_No unreleased changes tracked yet._

---

## [0.1.0] — 2026-08-28

Initial public release of the Stellar Save React SPA.

### Added

#### Core UI
- Group creation, join, and contribution flow implemented as React pages under
  `src/pages/`.
- `GroupCard` component for browsing and previewing savings groups.
- `ContributionFlow` component with step-based UX for submitting on-chain
  contributions.
- `TransactionHistory` component for reviewing past contributions and payouts.
- Admin dashboard (`AdminDashboardPage`) with platform stats, user/group
  moderation tables, and audit-log tail; calls the v2 admin API.

#### Design system
- Material-UI v7 (`@mui/material ^7.3.9`) with MUI X Data Grid for tabular
  views.
- Centralised design-token layer: `src/ui/theme/tokens.ts` and
  `src/ui/theme/theme.ts`.
- `AppThemeProvider` and component-wrapper re-exports under
  `src/ui/components/index.ts`.
- `AppLayout` shell with responsive navigation.
- Dark-mode toggle (persisted to `localStorage`).

#### State management
- React Query (`@tanstack/react-query ^5`) as the single source of truth for
  all server state.
- Query key registry at `src/lib/queryKeys.ts`; stale-time config at
  `src/lib/queryClient.ts`.
- `useGroupMutations` hook for write operations with automatic query
  invalidation.
- Offline fallback composable `useOfflineGroupsCache` backed by IndexedDB
  (`idb ^8`).

#### Wallet integration
- Multi-wallet support via `@creit.tech/stellar-wallets-kit ^2.2.0`:
  Freighter, Lobstr, and Albedo adapters.
- `WalletProvider` context at `src/wallet/WalletProvider.tsx`.
- Typed adapter interface `src/wallet/types.ts`.

#### Internationalisation (i18n)
- `i18next` + `react-i18next` integration; locale files under
  `src/locales/`.
- Initial translations: English (en), with framework in place for French (fr)
  and Yoruba (yo).

#### Progressive Web App (PWA)
- Service-worker (`public/sw.js`) based on Workbox for offline asset caching.
- Web App Manifest (`public/manifest.json`) with icons for installability.
- Offline fallback page (`public/offline.html`).

#### Deep linking
- Universal-link / App-link support for iOS (`ios/`) and Android (`android/`)
  via Capacitor.
- Deep-link configuration documented in `DEEP_LINKING_README.md`.
- Apple App Site Association at `docs/apple-app-site-association.json`; Android
  Asset Links at `docs/assetlinks.json`.

#### Accessibility
- axe-core integration (`@axe-core/react`) in development builds.
- Accessibility test suite (`src/test/a11y.test.tsx`) enforcing zero axe
  violations on key views.
- pa11y-ci configuration (`.pa11yrc.json`) for CI accessibility audits.
- WCAG 2.1 AA as the target conformance level; see `ACCESSIBILITY.md`.

#### Routing
- React Router v7 (`react-router-dom ^7`) with lazy-loaded route chunks.
- `src/routing/` directory for route definitions and guards.

#### Analytics & monitoring
- Sentry (`@sentry/react`) integrated for error tracking in production builds.
- Funnel analytics composables in `analytics/` package.

#### Testing
- Vitest v2 with `@vitest/coverage-v8`; coverage gate: 80 % lines / 70 %
  branches.
- React Testing Library (`@testing-library/react ^16`).
- Playwright for E2E journeys (`e2e/rosca-journey.spec.ts`,
  `e2e/wallet-automation.spec.ts`, `e2e/offline-contribution-queue.spec.ts`).
- Visual regression via Percy (`@percy/playwright`).
- Mutation testing via Stryker (`stryker.config.mjs`).
- Lighthouse CI (`.lighthouserc.json`) for performance and a11y scores.

### Changed
- N/A (initial release).

### Deprecated

#### `useMembers` and `useLeaderboard` hand-rolled cache pattern (relates to #56)
These two hooks (`src/hooks/useMembers.ts` and `src/hooks/useLeaderboard.ts`)
use a module-level `Map` cache with `useState`/`useEffect` fetching — a second,
competing cache paradigm predating the adoption of React Query. They are
load-bearing and retained for now, but **will be migrated to React Query in a
future release**.

- Their `clearMembersCache` / `clearLeaderboardCache` exports must remain until
  the migration lands.
- **Do not** copy the `Map`-cache pattern into any new hooks; all new
  server-state hooks must use `useQuery` / `useMutation` from React Query.

Migration target:

```ts
// ❌ Old pattern (useMembers / useLeaderboard)
const [members, setMembers] = useState<Member[]>([]);
useEffect(() => { fetchMembers(groupId).then(setMembers); }, [groupId]);

// ✅ New pattern (React Query)
const { data: members } = useQuery({
  queryKey: queryKeys.members(groupId),
  queryFn: () => fetchMembers(groupId),
  staleTime: STALE_TIME,
});
```

### Removed
- N/A (initial release).

### Fixed
- N/A (initial release).

### Security
- `VITE_` prefix enforced on all browser-exposed environment variables; private
  keys and admin credentials must never appear in frontend env files.
- Content-Security-Policy configured in production Vite build.
- Dependency vulnerability scanning via GitHub Dependabot and
  `.github/workflows/dependency-scan.yml`.

---

## Upgrade Notes

### React Query migration for `useMembers` / `useLeaderboard`
When these hooks are migrated (tracked in #56), callers will need to:
1. Remove any direct calls to `clearMembersCache()` / `clearLeaderboardCache()`.
2. Use `queryClient.invalidateQueries({ queryKey: queryKeys.members(groupId) })`
   instead to bust the cache after a mutation.

---

[Unreleased]: https://github.com/Xoulomon/Stellar-Save/compare/frontend/v0.1.0...HEAD
[0.1.0]: https://github.com/Xoulomon/Stellar-Save/releases/tag/frontend/v0.1.0
