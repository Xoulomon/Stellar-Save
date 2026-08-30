import { describe, it, expect } from 'vitest';
import { envSchema, parseEnv, EnvValidationError } from '../lib/env';

/** A minimal, fully valid raw env record — mirrors what Vite injects. */
function validRawEnv(overrides: Record<string, unknown> = {}) {
  return {
    MODE: 'development',
    PROD: false,
    DEV: true,
    VITE_STELLAR_NETWORK: 'testnet',
    VITE_STELLAR_RPC_URL: 'https://soroban-testnet.stellar.org',
    VITE_STELLAR_SAVE_CONTRACT_ID: 'CABCDEF123',
    VITE_API_BASE_URL: '/api/v1',
    VITE_ADMIN_ADDRESSES: '',
    VITE_ENABLE_ERROR_REPORTING: 'false',
    VITE_OTEL_ENABLED: 'false',
    VITE_OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
    VITE_OTEL_SERVICE_NAME: 'stellar-save-frontend',
    VITE_OTEL_TRACES_SAMPLER_ARG: '0.1',
    VITE_OTEL_PROPAGATE_URLS: '/api',
    ...overrides,
  };
}

describe('envSchema / parseEnv — valid input', () => {
  it('parses a fully specified, valid env record', () => {
    const env = parseEnv(validRawEnv());

    expect(env.VITE_STELLAR_NETWORK).toBe('testnet');
    expect(env.VITE_STELLAR_RPC_URL).toBe('https://soroban-testnet.stellar.org');
    expect(env.VITE_STELLAR_SAVE_CONTRACT_ID).toBe('CABCDEF123');
    expect(env.VITE_API_BASE_URL).toBe('/api/v1');
    // String 'true'/'false' flags are coerced to real booleans.
    expect(env.VITE_ENABLE_ERROR_REPORTING).toBe(false);
    expect(env.VITE_OTEL_ENABLED).toBe(false);
    // Numeric strings are coerced to numbers.
    expect(env.VITE_OTEL_TRACES_SAMPLER_ARG).toBe(0.1);
  });

  it('applies documented defaults when optional variables are entirely absent', () => {
    const env = parseEnv({ MODE: 'development', PROD: false, DEV: true });

    expect(env.VITE_STELLAR_NETWORK).toBe('testnet');
    expect(env.VITE_STELLAR_RPC_URL).toBe('https://soroban-testnet.stellar.org');
    expect(env.VITE_STELLAR_SAVE_CONTRACT_ID).toBe('');
    expect(env.VITE_API_BASE_URL).toBe('/api/v1');
    expect(env.VITE_ENABLE_ERROR_REPORTING).toBe(false);
    expect(env.VITE_OTEL_ENABLED).toBe(false);
    expect(env.VITE_OTEL_TRACES_SAMPLER_ARG).toBe(0.1);
    expect(env.VITE_OTEL_SERVICE_NAME).toBe('stellar-save-frontend');
  });

  it('accepts an unset, optional Sentry DSN', () => {
    const env = parseEnv(validRawEnv({ VITE_SENTRY_DSN: undefined }));
    expect(env.VITE_SENTRY_DSN).toBeUndefined();
  });
});

describe('envSchema / parseEnv — invalid / missing input', () => {
  it('throws EnvValidationError with a clear message when a required production var is missing', () => {
    // In a production build the contract ID becomes required — building
    // without it is a real deployment bug, not a dev-time convenience gap.
    const raw = validRawEnv({ PROD: true, VITE_STELLAR_SAVE_CONTRACT_ID: '' });

    expect(() => parseEnv(raw)).toThrow(EnvValidationError);
    try {
      parseEnv(raw);
      expect.unreachable('parseEnv should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const message = (err as Error).message;
      expect(message).toContain('VITE_STELLAR_SAVE_CONTRACT_ID');
      expect(message).toContain('required in production');
    }
  });

  it('does NOT require the contract ID outside of production (dev/test stay lenient)', () => {
    const env = parseEnv(validRawEnv({ PROD: false, VITE_STELLAR_SAVE_CONTRACT_ID: '' }));
    expect(env.VITE_STELLAR_SAVE_CONTRACT_ID).toBe('');
  });

  it('rejects an invalid VITE_STELLAR_NETWORK value with a clear message', () => {
    const raw = validRawEnv({ VITE_STELLAR_NETWORK: 'not-a-real-network' });

    expect(() => parseEnv(raw)).toThrow(EnvValidationError);
    try {
      parseEnv(raw);
      expect.unreachable('parseEnv should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      expect((err as Error).message).toContain('VITE_STELLAR_NETWORK');
    }
  });

  it('rejects a malformed URL for VITE_STELLAR_RPC_URL', () => {
    const raw = validRawEnv({ VITE_STELLAR_RPC_URL: 'not-a-url' });
    const result = envSchema.safeParse(raw);

    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => issue.path.join('.'));
      expect(fields).toContain('VITE_STELLAR_RPC_URL');
    }
  });

  it('reports every failing field at once, not just the first', () => {
    const raw = validRawEnv({
      VITE_STELLAR_NETWORK: 'bogus',
      VITE_STELLAR_RPC_URL: 'also-not-a-url',
    });
    const result = envSchema.safeParse(raw);

    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => issue.path.join('.'));
      expect(fields).toContain('VITE_STELLAR_NETWORK');
      expect(fields).toContain('VITE_STELLAR_RPC_URL');
    }
  });
});
