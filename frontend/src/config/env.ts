/**
 * config/env.ts — re-exports from the canonical env module.
 *
 * All environment variable access is centralised in `frontend/src/lib/env.ts`,
 * which uses Zod for validation and documents every VITE_* variable in one
 * place. This file exists only for backwards compatibility with any import
 * paths that reference `config/env` instead of `lib/env`.
 *
 * Do not add new variables here. Add them to `lib/env.ts` instead.
 *
 * @example
 * import { env } from '../lib/env';
 * const rpcUrl = env.VITE_STELLAR_RPC_URL;
 */
export { env, parseEnv, envSchema, EnvValidationError } from '../lib/env';
export type { Env, StellarNetwork } from '../lib/env';
