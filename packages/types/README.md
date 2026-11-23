# @stellar-save/types

Zero-dependency shared TypeScript types for the Stellar-Save monorepo.

## Purpose

Provides the single source of truth for domain types (`Transaction`, `GroupStatus`, `PaginationMeta`, etc.) and API envelope types (`ApiResponse`, `PaginatedResponse`, `ApiError`) that are consumed by **backend**, **frontend**, and **mobile** workspaces.

By living in a package with no runtime dependencies this package can be imported by any workspace without pulling in Stellar SDK binaries or browser-specific code.

## Rules

- **No runtime values.** Only `type`, `interface`, and `enum` exports.
- **No imports from other workspace packages.** This package must stay at the root of the dependency graph.
- When adding a new domain area, create a new file under `src/` and re-export from `src/index.ts`.

## Usage

```ts
import type { Transaction, PaginationMeta, ApiResponse } from '@stellar-save/types';
```

## Backwards compatibility

`@stellar-save/sdk` re-exports everything from this package so existing consumers importing from `@stellar-save/sdk` continue to work without changes.
