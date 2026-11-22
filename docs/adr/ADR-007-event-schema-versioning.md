# ADR-007: Event Schema Versioning and Domain Module Split

**Status**: Accepted  
**Date**: 2026-10-21  
**Author**: Stellar-Save Team  
**Deciders**: Architecture & Backend Team

## Context

`contracts/stellar-save/src/events.rs` defined every on-chain event emitted by
the contract. Two problems emerged as the contract grew:

1. **Size**: The single file exceeded 1 000 lines, making it hard to review
   changes in isolation and to tell at a glance whether a change was breaking
   for the indexer or for `packages/events-schema` consumers.

2. **No versioning**: Consumers of on-chain events (the backend indexer, the
   TypeScript `packages/events-schema` package, and third-party integrators)
   had no stable way to tell which shape of an event they were looking at when
   replaying historical data or handling events from multiple contract versions
   in parallel.

### Problem: what counts as a breaking change?

A breaking change is any mutation to an already-deployed event that causes a
consumer written for the old shape to misparse or silently lose data:

- Removing a field from a struct.
- Renaming a field.
- Changing a field's type (e.g. `u32` → `u64`).
- Reordering fields (Soroban serialises by XDR field position).
- Changing the event topic string.

Non-breaking changes (backward-compatible):

- Adding a new field **at the end** of a struct.
- Adding a brand-new event topic.
- Updating documentation comments.

## Decision

### 1. Split events.rs into domain modules

The single `events.rs` file is split into four domain modules living in the
`events/` directory:

| Module             | Covers                                                    |
|--------------------|-----------------------------------------------------------|
| `events/group.rs`  | Group lifecycle, membership, invitations, ratings         |
| `events/contribution.rs` | Contributions, penalties, cycles, auto-pay          |
| `events/payout.rs` | Payout execution                                          |
| `events/admin.rs`  | Contract-level pause/unpause, upgrades, disputes          |

`events.rs` remains the module root and includes the sub-modules via `#[path]`
attributes. The public `EventEmitter` facade in `events.rs` delegates to
domain-level free functions, keeping the call sites in the rest of the contract
unchanged.

Each domain module must not exceed 500 lines. If a module approaches that
limit, create a further sub-domain split and update this ADR.

### 2. schema_version field on every event struct

Every `#[contracttype]` struct gains a `pub schema_version: u32` field as its
**first** field. Each domain module declares a constant:

```rust
pub const GROUP_SCHEMA_VERSION: u32 = 1;
```

Every `emit_*` constructor hard-codes the constant:

```rust
GroupCreated {
    schema_version: GROUP_SCHEMA_VERSION,
    group_id,
    // …
}
```

The version is scoped per domain (group, contribution, payout, admin). A
breaking change to any event within a domain bumps that domain's constant. Only
the domain constant affected needs to change — the others remain stable.

### 3. schema.json and generated TypeScript

`packages/events-schema/schema.json` declares `"schema_version": "u32"` as the
first field of every event entry. `codegen.js` enforces this at generation time
and exits non-zero if any entry is missing it. The generated `events.ts` exposes
a `schemaVersion: number` field on every interface and a top-level
`CURRENT_SCHEMA_VERSION` constant.

### 4. Drift detection

Three automated gates keep the sources in sync:

| Gate | Trigger | Checks |
|------|---------|--------|
| `cargo test` in events module | Rust unit tests | Domain source files ↔ schema.json (topic coverage, uniqueness, schema_version presence) |
| `node check-rust-drift.js` | CI / pre-merge | Domain source files ↔ schema.json (same, without Rust toolchain) |
| `node check-drift.js` | CI / pre-merge | schema.json ↔ generated/events.ts |

## Breaking-change rules

### When a change IS breaking

Any of the following require a `schema_version` bump:

1. **Remove a field** — indexers reading old events will fail to deserialise.
2. **Rename a field** — old consumers reference the old name.
3. **Change a field type** — XDR type mismatch.
4. **Reorder fields** — XDR serialises positionally; reordering silently
   corrupts values.
5. **Remove or rename a topic string** — indexers filter by topic; changing it
   breaks subscriptions and historical replay.

### When a change is NOT breaking

These do NOT require a version bump:

1. **Add a new field at the end of a struct** — XDR appends unknown fields;
   old consumers ignore them.
2. **Add a brand-new event topic** — consumers that do not subscribe to it are
   unaffected.
3. **Edit doc comments** — no runtime effect.
4. **Add a new `emit_*` helper** — additive, no struct change.

### How to bump the version

1. Increment the domain constant, e.g.:
   ```rust
   pub const GROUP_SCHEMA_VERSION: u32 = 2;
   ```
2. Update `schema.json` — add the new field or rename the entry as needed.
3. Bump `"version"` in the top-level `schema.json` if **any** domain changes
   (this drives `CURRENT_SCHEMA_VERSION` in the generated TypeScript).
4. Update the indexer to handle both the old and new `schema_version` values
   during the transition window (dual-read support).
5. Run `node packages/events-schema/codegen.js` and commit the regenerated
   `generated/events.ts`.
6. Update this ADR's version history table below.

### Migration window

On-chain events are immutable once emitted. After deploying a contract version
that bumps `schema_version`, the indexer **must** continue to handle
`schema_version = N-1` events for as long as historical replay is required.
Minimum retention: the full cycle duration of the longest active group plus 90
days. After that window, old-version handling code may be removed.

## Consequences

### Positive

- ✅ No event module exceeds 500 lines — domain boundaries are clear.
- ✅ Every on-chain event carries its own schema version — consumers can
  branch on `schema_version` without out-of-band coordination.
- ✅ Three automated drift-detection gates catch mismatches before merge.
- ✅ The `EventEmitter` facade is unchanged — no call-site churn in the rest
  of the contract.
- ✅ TypeScript consumers get a `schemaVersion` field on every event interface
  and a `CURRENT_SCHEMA_VERSION` constant for assertion.

### Negative

- ❌ Every event struct is one field larger on-chain (4 bytes for `u32`).
  This is accepted: clarity and safety outweigh the marginal storage cost.
- ❌ Breaking changes now require a coordinated deploy (contract + indexer +
  schema package). This is unavoidable for any versioned protocol.

## Version history

| Version | Date       | Domain affected | Change summary               |
|---------|------------|-----------------|------------------------------|
| 1       | 2026-10-21 | all             | Initial versioning, all events start at v1 |

## Related decisions

- ADR-001: Choice of Soroban platform
- ADR-003: Backend event indexing approach
- ADR-004: Contract module boundaries

## References

- `contracts/stellar-save/src/events.rs` — module root and EventEmitter facade
- `contracts/stellar-save/src/events/` — domain sub-modules
- `packages/events-schema/schema.json` — canonical event schema
- `packages/events-schema/codegen.js` — TypeScript type generation
- `packages/events-schema/check-rust-drift.js` — Rust ↔ schema drift check
