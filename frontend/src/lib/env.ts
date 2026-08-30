/**
 * env.ts
 *
 * Single source of truth for reading and validating environment variables in
 * the frontend. All `import.meta.env` access should go through this module
 * instead of being read ad hoc across the codebase — that way every variable
 * has one declared type, one documented default, and is checked once, at
 * startup, instead of failing unpredictably deep inside whatever feature
 * happens to read it first.
 *
 * Validation runs once, eagerly, when this module is first imported (see the
 * `export const env = parseEnv();` at the bottom). Because `env` is imported
 * transitively by `main.tsx`, a misconfigured deployment fails immediately
 * with a readable error instead of surfacing as a confusing runtime bug
 * later (e.g. a blank explorer link, a 404 against `/api/v1undefined`, or a
 * silent no-op contract call).
 *
 * To add a new `VITE_*` variable:
 *   1. Add it to `envSchema` below with the right type/validation.
 *   2. Document it (and its default, if any) in the repo root `.env.example`.
 *   3. Read it elsewhere via `import { env } from '../lib/env'` — never via
 *      `import.meta.env` directly.
 */

import { z } from 'zod';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Vite always serializes `VITE_*` variables as strings (or leaves them
 * `undefined` when unset) — there is no native boolean env type. This turns
 * the conventional `'true'` / `'false'` string into a real boolean, treating
 * anything else (including unset) as `false` unless a default is supplied.
 */
function booleanFlag(defaultValue: boolean) {
  return z
    .string()
    .optional()
    .transform((value) => (value === undefined ? defaultValue : value === 'true'));
}

const stellarNetworkSchema = z.enum(['testnet', 'mainnet', 'futurenet', 'standalone']);

export type StellarNetwork = z.infer<typeof stellarNetworkSchema>;

// ─── Schema ─────────────────────────────────────────────────────────────────
//
// Every variable the frontend reads today, mirrored 1:1 from the previous
// `import.meta.env[...] ?? <default>` call sites so behaviour is preserved.
// `.superRefine` below adds one *new* constraint: in a production build the
// contract ID can no longer be silently blank — see the comment there.

export const envSchema = z
  .object({
    // Vite built-ins (typed by the `vite/client` triple-slash reference).
    MODE: z.string().default('development'),
    PROD: z.boolean().default(false),
    DEV: z.boolean().default(true),

    // ── Stellar network / contract ───────────────────────────────────────
    VITE_STELLAR_NETWORK: stellarNetworkSchema.default('testnet'),
    VITE_STELLAR_RPC_URL: z.url().default('https://soroban-testnet.stellar.org'),
    VITE_STELLAR_SAVE_CONTRACT_ID: z.string().default(''),

    // ── Backend API ───────────────────────────────────────────────────────
    // Intentionally a plain string, not `.url()` — the default is a
    // same-origin relative path ("/api/v1"), which is not a valid absolute URL.
    VITE_API_BASE_URL: z.string().default('/api/v1'),

    // ── Admin UI (optimistic, UI-only guard — server enforces the real check) ──
    VITE_ADMIN_ADDRESSES: z.string().default(''),

    // ── Error reporting ──────────────────────────────────────────────────
    VITE_ENABLE_ERROR_REPORTING: booleanFlag(false),
    VITE_SENTRY_DSN: z.url().optional(),

    // ── OpenTelemetry web tracing (opt-in; see lib/tracing.ts) ───────────
    VITE_OTEL_ENABLED: booleanFlag(false),
    VITE_OTEL_EXPORTER_OTLP_ENDPOINT: z.url().default('http://localhost:4318'),
    VITE_OTEL_SERVICE_NAME: z.string().default('stellar-save-frontend'),
    VITE_OTEL_TRACES_SAMPLER_ARG: z.coerce.number().min(0).max(1).default(0.1),
    // CSV of URL prefixes — also plain strings/paths (e.g. "/api"), not URLs.
    VITE_OTEL_PROPAGATE_URLS: z.string().default('/api'),
  })
  .superRefine((value, ctx) => {
    // The app *works* in dev/test with no contract deployed (every contract
    // call already fails with a clear ContractError telling you to set this).
    // Shipping a production build with no contract ID is a real deployment
    // bug, though, so promote it to a hard, fail-fast requirement there.
    if (value.PROD && value.VITE_STELLAR_SAVE_CONTRACT_ID.trim() === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['VITE_STELLAR_SAVE_CONTRACT_ID'],
        message:
          'VITE_STELLAR_SAVE_CONTRACT_ID is required in production builds. ' +
          'Set it in your .env file before running `npm run build`.',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

// ─── Validation ─────────────────────────────────────────────────────────────

/** Minimal, version-stable shape we need from a Zod validation issue. */
interface FieldIssue {
  path: ReadonlyArray<PropertyKey>;
  message: string;
}

export class EnvValidationError extends Error {
  constructor(issues: readonly FieldIssue[]) {
    const lines = issues.map((issue) => {
      const field = issue.path.map(String).join('.') || '(root)';
      return `  - ${field}: ${issue.message}`;
    });
    super(
      [
        'Invalid environment configuration:',
        ...lines,
        '',
        'Check your .env file against the repo root .env.example and try again.',
      ].join('\n'),
    );
    this.name = 'EnvValidationError';
  }
}

/**
 * Validates a raw environment record against `envSchema`. Defaults to
 * `import.meta.env` but accepts an explicit record so it can be unit tested
 * without mutating global env state.
 *
 * Throws `EnvValidationError` — with every failing variable listed, not just
 * the first — when validation fails.
 */
export function parseEnv(raw: Record<string, unknown> = import.meta.env): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new EnvValidationError(result.error.issues);
  }
  return result.data;
}

/**
 * Validated, typed environment variables. Import this instead of reading
 * `import.meta.env` directly.
 *
 * Validation happens once, at module-load time: importing `env` anywhere
 * that runs during app startup (directly or transitively) is what makes
 * config errors fail fast instead of surfacing later as confusing bugs.
 */
export const env = parseEnv();
