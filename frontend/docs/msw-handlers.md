# MSW Handler Convention

This document describes how Mock Service Worker (MSW) is set up in the
Stellar Save frontend test suite and the conventions for adding new handlers.

## Overview

[MSW v2](https://mswjs.io/) is used to intercept all network calls in unit
and component tests running under Vitest + jsdom. Handlers are defined in
`src/__mocks__/msw/handlers/` and the Node server is started automatically
by the global test setup in `src/test/setup.ts`.

```
src/
  __mocks__/
    msw/
      browser.ts          ← setupWorker() for dev server / Storybook
      server.ts           ← setupServer() singleton for Vitest tests
      handlers/
        index.ts          ← barrel: exports `handlers` array + all factories
        backend.ts        ← /api/* REST handlers
        graphql.ts        ← GraphQL operation handlers
        horizon.ts        ← Horizon / Soroban REST handlers
  test/
    setup.ts              ← starts / resets / closes server globally
```

---

## Handler Groups

| File                         | Coverage                                          |
|------------------------------|---------------------------------------------------|
| `handlers/backend.ts`        | `/api/groups`, `/api/users`, `/api/auth`, etc.    |
| `handlers/graphql.ts`        | GraphQL operations (GetGroups, GetMembers, …)     |
| `handlers/horizon.ts`        | `horizon-testnet.stellar.org` / mainnet / futurenet |

Each file exports:
1. A **factory function** (`createBackendHandlers`, etc.) that returns the
   array of handlers.
2. **Default fixture constants** (`DEFAULT_GROUPS`, `DEFAULT_PAYMENTS_PAGE`,
   etc.) that tests can import for assertions without duplicating data.

---

## Adding a New Handler

### 1. Choose the right file

| Network target                            | Add to              |
|-------------------------------------------|---------------------|
| `fetch('/api/...')`                       | `handlers/backend.ts` |
| GraphQL POST to `http://localhost:4000/graphql` | `handlers/graphql.ts` |
| `fetch('https://horizon*.stellar.org/…')` | `handlers/horizon.ts` |

### 2. Add a fixture constant (optional but recommended)

```ts
// handlers/backend.ts
export const DEFAULT_FEEDBACK = [
  { id: 'f1', message: 'Great app!', rating: 5 },
];
```

### 3. Add the handler inside the factory function

```ts
// handlers/backend.ts  — inside createBackendHandlers()
http.get('/api/feedback', () => {
  return HttpResponse.json(DEFAULT_FEEDBACK);
}),
```

### 4. Re-export from `handlers/index.ts` if you added a new fixture

The index barrel re-exports everything with `export * from './backend'`, so
new constants are automatically available without any changes to `index.ts`.

---

## Overriding Handlers in Tests

Use `server.use(...)` inside `beforeEach` or inside an individual test to
replace the default handler for that scope. `server.resetHandlers()` is called
automatically after every test by `setup.ts`, so overrides never leak.

```ts
import { http, HttpResponse } from 'msw';
import { server } from '../__mocks__/msw/server';

describe('handles errors', () => {
  it('shows an error banner when the groups endpoint returns 500', async () => {
    server.use(
      http.get('/api/groups', () =>
        HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 })
      )
    );

    render(<GroupsPage />);
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });
});
```

For GraphQL operations use the `graphql` namespace:

```ts
import { graphql, HttpResponse } from 'msw';
import { server } from '../__mocks__/msw/server';

server.use(
  graphql.query('GetGroups', () =>
    HttpResponse.json({ errors: [{ message: 'Unauthorized' }] })
  )
);
```

---

## Checking for Unhandled Requests

The server is started with `{ onUnhandledRequest: 'warn' }`. Any `fetch` call
that does not match a registered handler will produce a console warning:

```
[MSW] Warning: intercepted a request without a matching request handler:
  GET https://example.com/some-unhandled-path
```

If you see this warning, either add a handler or use `vi.mock` if the call is
from a module you want to stub entirely (e.g. `contractClient`).

---

## When NOT to Use MSW

MSW is for **HTTP fetch calls**. For other boundaries, keep using `vi.mock`:

| Boundary                          | Use                                        |
|-----------------------------------|--------------------------------------------|
| Soroban contract calls            | `vi.mock('../lib/contractClient', …)`      |
| `@stellar/stellar-sdk`            | `vi.mock('@stellar/stellar-sdk')` (manual mock) |
| Wallet adapters (Freighter, etc.) | `vi.mock('../hooks/useWallet', …)`         |
| Pure module utilities             | `vi.mock(…)` or just import and call       |

---

## Browser / Dev Server Usage

The browser worker (`src/__mocks__/msw/browser.ts`) is **not** used in tests.
To enable it in the Vite dev server for local development, add the following
to `src/main.tsx` and run `npx msw init public/` once to generate the service
worker script:

```ts
if (import.meta.env.DEV && import.meta.env.VITE_MSW === 'true') {
  const { worker } = await import('./__mocks__/msw/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}
```

Then add `VITE_MSW=true` to your `.env.local`.
