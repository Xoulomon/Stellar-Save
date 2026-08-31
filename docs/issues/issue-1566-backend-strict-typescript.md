# Issue #1566 — Add Strict TypeScript Config to Backend

## Summary

`backend/tsconfig.json` already sets `"strict": true`, but immediately weakens
the guarantee with `"strictPropertyInitialization": false`. This carve-out
disables the check that catches the most common class of runtime `undefined`
errors in a NestJS / Express backend — accessing a class property before it has
been assigned in the constructor. Aligning the backend fully with strict TypeScript
(matching the intent of issue #111 for the frontend) eliminates a whole category
of silent bugs and ensures both workspaces hold the same type-safety bar.

---

## Current State of `backend/tsconfig.json`

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2022",
    "sourceMap": true,
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "strictPropertyInitialization": false,   // <-- carve-out to fix
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "types": ["jest", "node"],
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "exclude": [
    "node_modules",
    "dist",
    "../packages/events-schema/generated"
  ]
}
```

### What `"strict": true` enables (already active)

- `strictNullChecks` — `null` / `undefined` are not assignable to other types
- `strictFunctionTypes` — contravariant function parameter checking
- `strictBindCallApply` — typed `bind`/`call`/`apply`
- `noImplicitAny` — variables must have an explicit or inferred type
- `noImplicitThis` — `this` in functions must be typed

### What `"strictPropertyInitialization": false` suppresses

`strictPropertyInitialization` requires that every class property declared
without `!` (definite assignment assertion) is either:
- assigned in the constructor, or
- given a default value at the declaration site

With it disabled, code like this compiles silently:

```ts
class AnalyticsService {
  private prisma: PrismaClient;   // never assigned → undefined at runtime
  // constructor is missing or does not assign this.prisma
}
```

This is the exact pattern visible in `backend/src/analytics_service.ts`:

```ts
export class AnalyticsService {
  private prisma: any;              // typed any — masked by strictPropertyInitialization: false
  private cacheClient = redis;
  private cacheTTL = 3600;

  constructor(prisma: any) {
    this.prisma = prisma;           // actually assigned — this specific case is fine
  }
```

The `any` type on `prisma` is a separate concern; the carve-out is needed
because other classes in `backend/src` use NestJS `@Injectable()` with
property-injected dependencies that are assigned by the DI framework, not the
constructor — a pattern that requires either `!` assertions or the carve-out.

---

## What the Fix Involves

### Step 1 — Remove the carve-out

```jsonc
// backend/tsconfig.json
{
  "compilerOptions": {
    "strict": true
    // Remove: "strictPropertyInitialization": false
  }
}
```

### Step 2 — Fix resulting type errors

After removing the carve-out, three patterns of error will surface:

#### Pattern A — NestJS injected properties (most common)

NestJS injects constructor-less dependencies via `@Inject()`. The fix is to add
a definite assignment assertion (`!`) since the DI framework guarantees
assignment before any method is called:

```ts
// Before (silent with strictPropertyInitialization: false):
@Injectable()
class NotificationService {
  @InjectRepository(User)
  private readonly userRepository: Repository<User>;
}

// After (explicit contract with DI framework):
@Injectable()
class NotificationService {
  @InjectRepository(User)
  private readonly userRepository!: Repository<User>;
}
```

#### Pattern B — Lazy-initialised properties

Properties set in lifecycle hooks (`onModuleInit`) rather than constructors:

```ts
// Before:
class BackupService {
  private scheduler: NodeJS.Timer;   // set in onModuleInit, not constructor
}

// After — option 1: definite assignment assertion
private scheduler!: NodeJS.Timer;

// After — option 2: union with undefined (more honest)
private scheduler: NodeJS.Timer | undefined;
```

Option 2 is preferred where the property genuinely may not be set (e.g. when a
feature flag disables initialisation), because it forces callers to handle the
`undefined` case explicitly rather than silently assuming it is set.

#### Pattern C — `any`-typed properties masking real issues

Several files in `backend/src` use `private prisma: any` to avoid typing the
Prisma client. With `strict` fully enabled, this pattern still compiles — but
it is worth tightening to `PrismaClient` where possible:

```ts
// analytics_service.ts — current
private prisma: any;

// Tighter — catches typos in Prisma method names at compile time
import type { PrismaClient } from '@prisma/client';
private prisma: PrismaClient;
```

This is a separate cleanup task but is natural to address in the same PR.

---

## Files Most Likely to Require Changes

Based on the `backend/src` directory listing:

| File | Likely pattern |
|---|---|
| `analytics_service.ts` | Pattern C (`prisma: any`) |
| `analytics_aggregator.ts` | Pattern C (`prisma: PrismaClient` already typed — check constructors) |
| `notification_service.ts` | Pattern A (NestJS `@Injectable`) |
| `push_notification_service.ts` | Pattern A |
| `email_service.ts` | Pattern A |
| `fraud_detection_service.ts` | Pattern A |
| `backup_service.ts` | Pattern B (lifecycle hooks) |
| `backup_scheduler.ts` | Pattern B |
| `auth_service.ts` | Pattern A |
| `jobs/*` | Pattern A or B (BullMQ job processors) |

---

## Acceptance Criteria

### AC1 — `strict: true` with no carve-outs

`backend/tsconfig.json` contains `"strict": true` and does **not** contain
`"strictPropertyInitialization": false` (or any other line that relaxes a
`strict` sub-flag).

### AC2 — Zero type errors

```powershell
cd backend
npm run typecheck   # runs: tsc --noEmit
```

exits with code `0` and produces no output.

### AC3 — Typecheck passes in CI

The existing CI step that runs `npm run typecheck` (or `npm run build`) in the
`backend` workspace must be green. No new `// @ts-ignore` or `// @ts-expect-error`
suppressions may be added to pass — every error must be properly fixed.

---

## Migration Strategy

Because the carve-out has been in place from the start, removing it will likely
surface errors across many files simultaneously. The recommended approach:

1. **Remove the carve-out and run `tsc --noEmit`** — capture the full error list.
2. **Group errors by pattern** (A, B, C above).
3. **Fix Pattern A first** — mechanical `!` addition on `@Inject` properties;
   low risk, easy to review.
4. **Fix Pattern B** — decide per-property whether `!` or `| undefined` is more
   appropriate. Prefer `| undefined` for optional lifecycle properties.
5. **Fix Pattern C** — tighten `any` types to `PrismaClient` or the correct
   imported type where straightforward; leave complex `any` usages for a
   follow-up.
6. **Run tests** — `npm test` in `backend/` must pass after all fixes.

---

## Suggested Test / Verification

There is no runtime test for a TypeScript config change — the check is the
typecheck itself. The CI command is:

```powershell
cd backend
npm run typecheck
```

Add this as a required check in the PR description so reviewers know to look
at the `tsc` output rather than just the unit test results.

---

## Relationship to Issue #111

Issue #111 (frontend strict TypeScript) is the counterpart to this issue.
Once both are complete, the entire TypeScript surface of Stellar-Save — frontend
(`vitest` / `tsc`), backend (`jest` / `tsc`), and shared SDK — will operate
under a consistent strict-mode contract, making cross-boundary type errors
detectable at compile time rather than at runtime in production.

---

## Affected Files

| File | Change type |
|---|---|
| `backend/tsconfig.json` | Remove `"strictPropertyInitialization": false` |
| `backend/src/**/*.ts` | Fix `!` assertions, `| undefined` unions, or type tightenings as needed |

---

## Related

- Issue #111 — Frontend strict TypeScript (counterpart)
- Issue #1567 — Dependency vulnerability scanning
- `backend/tsconfig.json` — current config
- `backend/package.json` — `"typecheck": "tsc --noEmit"` script
- NestJS docs on strict mode: https://docs.nestjs.com/techniques/configuration#schema-validation
