# Routing

Routes are defined per feature domain in `src/routing/domains/` and composed
into the top-level table in `src/routing/routes.tsx`.

| File                     | Owns                                                                           |
| ------------------------ | ------------------------------------------------------------------------------ |
| `domains/core.tsx`       | Home, landing, dashboard, profile, settings, about, app download               |
| `domains/savings.tsx`    | Groups, templates, leaderboard, analytics, invites                             |
| `domains/wallet.tsx`     | Transactions, transaction builder, hardware wallet, deposit/withdraw, recovery |
| `domains/governance.tsx` | Governance proposals                                                           |
| `domains/admin.tsx`      | Admin dashboard, feedback admin, platform analytics                            |
| `domains/fallback.tsx`   | 404, error, and the dev-only visual gallery (must stay last)                   |

## Adding routes for a feature

1. Add the path to `ROUTES` in `src/routing/constants.ts`.
2. Add a `lazy()` page import and a `RouteConfig` entry to the matching domain
   file. Every page component must be lazy-loaded (enforced by
   `src/test/lazyRoutes.test.ts`).
3. For a new domain, create `domains/<feature>.tsx` exporting
   `<feature>Routes: RouteConfig[]` and spread it into `routeConfig` in
   `routes.tsx`, before `fallbackRoutes`.
