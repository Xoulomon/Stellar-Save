# Stellar Save Frontend

Frontend single-page application (SPA) for Stellar Save built with React, TypeScript, Vite, and Material-UI (MUI).

## Development & Setup

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Installation & Local Run
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start local development server with HMR
npm run dev
```

### Build & Testing
```bash
# Type-check and build production bundle
npm run build

# Run ESLint code quality checks
npm run lint

# Run unit and component tests (Vitest)
npm run test

# Run tests with code coverage report
npm run test:coverage
```

## Environment Configuration

Copy the example environment file `.env.example` in the root or create `.env` in `frontend/`:

```bash
VITE_STELLAR_NETWORK=testnet
VITE_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
VITE_CONTRACT_GUESS_THE_NUMBER=<your-contract-id>
VITE_CONTRACT_FUNGIBLE_ALLOWLIST=<your-contract-id>
VITE_CONTRACT_NFT_ENUMERABLE=<your-contract-id>
```

> **Note**: Variables prefixed with `VITE_` are exposed to the browser. Do not include private keys or sensitive administrative credentials in frontend environment files.

## Component Architecture & Design System

The frontend uses Material-UI with a centralized theme and wrapper layer:
- **Design Tokens**: `src/ui/theme/tokens.ts`
- **Theme Configuration**: `src/ui/theme/theme.ts`
- **App Theme Provider**: `src/ui/providers/AppThemeProvider.tsx`
- **Component Wrappers**: `src/ui/components/index.ts`
- **App Layout**: `src/ui/layout/AppLayout.tsx`
- **Detailed UI Guide**: Refer to [docs/ui-component-library.md](../docs/ui-component-library.md)

## State Management

React Query is the single source of truth for server state. There is no Redux
store in this app: `@reduxjs/toolkit`, `redux` and `redux-thunk` appear in
`package-lock.json` only as transitive dependencies of `recharts`, are not
listed in `package.json`, and no slice, reducer or `configureStore` call exists
anywhere in `src/`. Nothing to remove, and the dependency cannot be dropped
without dropping charting.

Conventions:

- Server data goes through a `useQuery` keyed off `src/lib/queryKeys.ts`, with
  the staleness window taken from `STALE_TIME` in `src/lib/queryClient.ts`.
- Writes go through a `useMutation` that invalidates the affected key family.
  See `src/hooks/useGroupMutations.ts`.
- Offline fallback is a composable, not query-hook logic. See
  `src/hooks/useOfflineGroupsCache.ts`.
- UI-only state (filters, pagination, form fields) stays in local `useState`.

Two hooks predate this and still keep hand-rolled module-level `Map` caches
with `useState`/`useEffect` fetching: `src/hooks/useMembers.ts` and
`src/hooks/useLeaderboard.ts`. They are a second, competing cache paradigm and
should migrate to React Query, but they are load-bearing and out of scope for
the boilerplate cleanup. Their `clearMembersCache` / `clearLeaderboardCache`
exports are real cache resets and must stay until the migration lands. Do not
copy this pattern into new hooks.

## Wallet Integration

Stellar wallet connection adapters and providers are defined in:
- `src/wallet/WalletProvider.tsx`
- `src/wallet/freighterAdapter.ts`
- `src/wallet/types.ts`
