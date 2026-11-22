import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isLevelEnabled,
  logger,
  redact,
  redactPayload,
  resetLogLevel,
  setLogLevel,
} from '../lib/logger';

describe('logger environment configuration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    resetLogLevel();
  });

  it('honors a valid minimum level outside production', () => {
    vi.stubEnv('PROD', false);
    vi.stubEnv('VITE_LOG_LEVEL', 'info');
    resetLogLevel();

    expect(isLevelEnabled('debug')).toBe(false);
    expect(isLevelEnabled('info')).toBe(true);
  });

  it('discards names inherited from the priority object', () => {
    vi.stubEnv('PROD', false);
    vi.stubEnv('VITE_LOG_LEVEL', 'toString');
    resetLogLevel();

    expect(isLevelEnabled('debug')).toBe(true);
  });

  it('keeps the production minimum at warn', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_LOG_LEVEL', 'debug');
    resetLogLevel();

    expect(isLevelEnabled('info')).toBe(false);
    expect(isLevelEnabled('warn')).toBe(true);
  });

  it('uses the environment default after a temporary override', () => {
    vi.stubEnv('PROD', false);
    vi.stubEnv('VITE_LOG_LEVEL', undefined);
    setLogLevel('error');
    expect(isLevelEnabled('warn')).toBe(false);

    resetLogLevel();
    expect(isLevelEnabled('debug')).toBe(true);
  });

  it.each(['debug', 'info', 'warn', 'error'] as const)('routes enabled %s messages', (level) => {
    const output = vi.spyOn(console, level).mockImplementation(() => {});
    setLogLevel('debug');
    logger[level]('example');
    expect(output).toHaveBeenCalledWith('example');
  });

  it('skips disabled messages', () => {
    const output = vi.spyOn(console, 'debug').mockImplementation(() => {});
    setLogLevel('warn');
    logger.debug('hidden');
    expect(output).not.toHaveBeenCalled();
  });
});

describe('logger redaction', () => {
  it('redacts sensitive fields and retains ordinary values', () => {
    const error = new Error('example');
    const address = '0x1234567890abcdef1234567890abcdef';
    const details = { address, payload: 'abcdefgh-secret', values: [address, error, 7, null] };

    expect(redact(details)).toEqual({
      address: '0x1234...cdef',
      payload: '[Payload len=15 prefix=abcdefgh...]',
      values: ['0x1234...cdef', { name: 'Error', message: 'example', stack: error.stack }, 7, null],
    });
  });

  it('handles circular objects without exposing a serialized payload', () => {
    const details: { self?: unknown; payload?: unknown } = {};
    details.self = details;
    details.payload = details;

    expect(redact(details)).toEqual({
      self: '[Circular]',
      payload: '[Unserializable payload]',
    });
    expect(redactPayload(null)).toBe('null');
  });
});
