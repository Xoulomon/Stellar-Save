# GraphQL Breaking-Change Process

This document explains how the schema snapshot test works, what counts as a
breaking change, and how to safely land an intentional one.

---

## How the snapshot test works

Every PR runs `npm run schema:check` (also executed by `npm test`) as part of
`backend-ci.yml`.  The check does three things:

1. **Drift detection** — prints both the committed snapshot and the current
   `typeDefs` through `printSchema()` and compares the two strings.  Even a
   one-character difference fails this gate, so the snapshot always reflects
   what is checked in.

2. **Breaking-change detection** — uses
   [`@graphql-inspector/core`](https://the-guild.dev/graphql/inspector) to
   `diff` the old schema (snapshot) against the new schema (current `typeDefs`).
   Any change classified as `CriticalityLevel.Breaking` fails the test with a
   clear description.

3. **Informational non-breaking report** — dangerous and safe changes (e.g.,
   adding a nullable field, adding a new enum value) are logged but never fail
   the suite.

The `ALLOW_BREAKING_SCHEMA=1` environment variable is **never** set in CI, so
bypassing the gate in a pipeline is not possible without editing the workflow.

---

## What counts as a breaking change?

A breaking change is anything that can cause existing consumers (frontends,
mobile clients, third-party integrations) to receive an error or unexpected
`null` without a code change on their side.  Common examples:

| Change | Breaking? |
|--------|-----------|
| Remove a field | ✅ Breaking |
| Rename a field | ✅ Breaking |
| Change a field type (e.g. `String` → `Int`) | ✅ Breaking |
| Make a nullable field non-null (`String` → `String!`) | ✅ Breaking |
| Remove an enum value | ✅ Breaking |
| Remove an argument | ✅ Breaking |
| Add a required argument | ✅ Breaking |
| Change an argument type | ✅ Breaking |
| Add a new nullable field | ✅ NonBreaking |
| Add a new optional argument | ✅ NonBreaking |
| Add a new type | ✅ NonBreaking |
| Add a new enum value | ⚠️ Dangerous (may break exhaustive switches) |
| Make a non-null field nullable (`String!` → `String`) | ✅ NonBreaking |

---

## How to land an intentional breaking change

Follow all steps in order.  Skipping step 4 (snapshot commit) will keep CI
broken for everyone else.

### Step 1 — Discuss the change

Open a GitHub issue or discussion to explain:

- What is changing and why.
- Which consumers are affected and what migration they need.
- The proposed deprecation / rollout window if applicable.

Link the issue in your PR description.

### Step 2 — Make your schema change

Edit `backend/src/graphql/schema.ts`.

### Step 3 — Confirm the failure locally

```bash
cd backend
npm run schema:check
```

You should see a failure message like:

```
1 breaking schema change(s) detected.
  • [FIELD_REMOVED] Field 'health' was removed from object type 'Query'

To approve this intentional breaking change:
  1. Run  npm run schema:update  to regenerate the snapshot.
  2. Commit the updated snapshot with a changelog entry.
See docs/graphql-breaking-changes.md for the full process.
```

### Step 4 — Regenerate the snapshot

```bash
cd backend
npm run schema:update
```

This overwrites `backend/src/graphql/snapshots/schema.graphql` with the new
SDL.  Verify the diff looks exactly as expected:

```bash
git diff backend/src/graphql/snapshots/schema.graphql
```

### Step 5 — Confirm the test now passes

```bash
npm run schema:check
```

All 4 tests should be green.

### Step 6 — Write a changelog entry

Add a section to `CHANGELOG.md` (or your PR description) under a
`### Breaking Changes` heading.  Include:

- The affected field / type / argument.
- Why the change was necessary.
- Migration instructions for consumers.

Example:

```markdown
### Breaking Changes

- **GraphQL** `Query.health` has been removed.  Use the REST `GET /health`
  endpoint instead (available since v1.2).
```

### Step 7 — Open the PR

Commit **both**:
- The updated `backend/src/graphql/schema.ts`
- The updated `backend/src/graphql/snapshots/schema.graphql`

Label the PR `breaking-change` so it is visible in the release pipeline.

---

## Using `ALLOW_BREAKING_SCHEMA=1` locally

During active development you can temporarily suppress the breaking-change
failure to iterate quickly without regenerating the snapshot on every save:

```bash
ALLOW_BREAKING_SCHEMA=1 npm run schema:check
```

This prints a warning for every breaking change but does **not** fail the test.
Do **not** commit or push with this env var set — CI never sets it, so the
pipeline will still fail.

---

## Automated snapshot update in CI (optional, advanced)

If your team frequently adds additive changes (new fields, new types) and finds
the manual snapshot update step noisy, you can add an auto-commit step to a
dedicated `schema-snapshot-update` branch workflow.  This is **not** enabled by
default because it bypasses the review gate on the snapshot file.  Discuss with
your team before enabling it.

---

## Files involved

| File | Purpose |
|------|---------|
| `backend/src/graphql/schema.ts` | Source of truth: SDL `typeDefs` string |
| `backend/src/graphql/snapshots/schema.graphql` | Committed snapshot; regenerated by `schema:update` |
| `backend/src/tests/schema-snapshot.test.ts` | Jest test that enforces the gate |
| `.github/workflows/backend-ci.yml` | CI workflow; runs `schema:check` before `test` |
| `backend/package.json` | `schema:update` and `schema:check` scripts |
