/**
 * Tests for config/env.ts (issue #2045 — centralize feature flags).
 *
 * Verifies that the config/env barrel correctly re-exports everything from
 * lib/env, keeping backwards compatibility without maintaining a duplicate
 * schema.
 */
import { describe, it, expect } from 'vitest';

import { env, parseEnv, envSchema, EnvValidationError } from './env';
import {
  env as libEnv,
  parseEnv as libParseEnv,
  envSchema as libEnvSchema,
  EnvValidationError as LibEnvValidationError,
} from '../lib/env';

describe('config/env re-export (issue #2045)', () => {
  it('re-exports the same env instance as lib/env', () => {
    // Both imports should point to the identical frozen object.
    expect(env).toBe(libEnv);
  });

  it('re-exports the same parseEnv function', () => {
    expect(parseEnv).toBe(libParseEnv);
  });

  it('re-exports the same envSchema', () => {
    expect(envSchema).toBe(libEnvSchema);
  });

  it('re-exports the same EnvValidationError class', () => {
    expect(EnvValidationError).toBe(LibEnvValidationError);
  });

  it('env has the expected Stellar network default', () => {
    expect(env.VITE_STELLAR_NETWORK).toBe('testnet');
  });

  it('env has the expected RPC URL default', () => {
    expect(env.VITE_STELLAR_RPC_URL).toBe('https://soroban-testnet.stellar.org');
  });

  it('env has VITE_ENABLE_ERROR_REPORTING defaulting to false', () => {
    expect(env.VITE_ENABLE_ERROR_REPORTING).toBe(false);
  });

  it('parseEnv accepts an explicit record and returns validated config', () => {
    const result = parseEnv({
      MODE: 'development',
      PROD: false,
      DEV: true,
      VITE_STELLAR_NETWORK: 'mainnet',
      VITE_STELLAR_RPC_URL: 'https://horizon.stellar.org',
      VITE_STELLAR_SAVE_CONTRACT_ID: 'GABCDEF',
      VITE_API_BASE_URL: '/api/v2',
      VITE_ADMIN_ADDRESSES: '',
      VITE_ENABLE_ERROR_REPORTING: 'false',
      VITE_OTEL_ENABLED: 'false',
      VITE_OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
      VITE_OTEL_SERVICE_NAME: 'test-service',
      VITE_OTEL_TRACES_SAMPLER_ARG: '0.5',
      VITE_OTEL_PROPAGATE_URLS: '/api',
    });
    expect(result.VITE_STELLAR_NETWORK).toBe('mainnet');
    expect(result.VITE_API_BASE_URL).toBe('/api/v2');
  });

  it('EnvValidationError includes the failing field in its message', () => {
    const err = new EnvValidationError([
      { path: ['VITE_STELLAR_NETWORK'], message: 'must be testnet or mainnet' },
    ]);
    expect(err.message).toContain('VITE_STELLAR_NETWORK');
    expect(err.name).toBe('EnvValidationError');
  });
});
