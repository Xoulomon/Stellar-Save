# Frontend State Management Standard

This document defines the single standard for state management across
`frontend/src/pages`. It exists to make data flow easy to trace and to stop the
inconsistent mix of local `useState`, React context, and ad-hoc global stores
that had accumulated across pages.

## The standard

1. **Local state by default.** State that is only read and written by a single
   page (or a single component subtree) lives in that page/component as
   `useState` / `useReducer`. Do not lift it into context just to share it with
   one child.
2. **Context for cross-cutting state only.** State that is genuinely shared
   across unrelated pages or the whole app (auth/session, theme, notifications,
   feature flags) lives in a provider under `frontend/src/context` and is
   consumed through the matching hook in `frontend/src/hooks`.
3. **No new global stores.** Do not introduce a global store (Redux/Zustand/
   custom singleton) for page-local data. If a global store already exists, it
   is reserved for the cross-cutting concerns in rule 2.
4. **One owner per piece of state.** Every value has exactly one source of
   truth. Derived values are computed at render time (or with `useMemo`), never
   duplicated into a second `useState`.
5. **Server data is not UI state.** Data fetched from the API is owned by the
   data-fetching layer/hook; pages consume it and keep only UI state (filters,
   open/closed, selection) locally.

### Decision guide

| Question | Answer |
| --- | --- |
| Used by one page/subtree? | Local `useState` / `useReducer` |
| Used by unrelated pages or app-wide? | Context provider + hook |
| Fetched from the API? | Data-fetching hook; page keeps UI state only |
| Derived from other state? | Compute it, don't store it |

## Inventory of current patterns

| Page | Current pattern | Target |
| --- | --- | --- |
| `pages/Dashboard.tsx` | Local `useState` for filters + duplicated derived totals | Local state, derive totals |
| `pages/Settings.tsx` | Local `useState` mirroring context values | Read context directly |
| `pages/Profile.tsx` | Local `useState` for form + context for session | Local form state, context for session |
| Other pages | Local `useState` | Already compliant |

## Migrated pages

The three worst offenders were migrated to the standard above with no behavior
change:

- `pages/Dashboard.tsx` — removed duplicated derived state; totals are now
  computed from the source list.
- `pages/Settings.tsx` — stopped mirroring context values into local state;
  the page reads the context hook directly.
- `pages/Profile.tsx` — form fields stay local; session data comes from the
  context hook instead of being copied into `useState`.

## Testing

- Unit tests cover the migrated pages' rendering and interactions.
- Manual smoke: load each migrated page, exercise filters/forms, confirm no
  behavior change.
