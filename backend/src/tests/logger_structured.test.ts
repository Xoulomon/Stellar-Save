import { Writable } from 'stream';

import winston from 'winston';

import { logger, errFields, winstonLogger } from '../lib/logger';

/**
 * Collects the JSON log lines Winston emits via a dedicated Stream transport,
 * so assertions don't depend on the timing of the Console transport's stdout
 * writes (which can be flushed after the test body returns).
 */
interface CapturedEntry {
  level?: string;
  message?: string;
  service?: string;
  userId?: string;
  count?: number;
  error?: string;
  stack?: string;
  detail?: unknown[];
  secret?: string;
  authorization?: string;
  password?: string;
  wallet?: {
    address?: string;
    secretKey?: string;
    seed?: string;
  };
  [key: string]: unknown;
}

function capture(fn: () => void): CapturedEntry[] {
  const chunks: string[] = [];
  const sink = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  const transport = new winston.transports.Stream({
    stream: sink,
    format: winston.format.json(),
  });
  winstonLogger.add(transport);
  try {
    fn();
  } finally {
    winstonLogger.remove(transport);
  }
  return chunks
    .join('')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

describe('errFields', () => {
  it('unwraps an Error into message + stack', () => {
    const fields = errFields(new Error('kaboom'));
    expect(fields.error).toBe('kaboom');
    expect(typeof fields.stack).toBe('string');
  });

  it('passes a string through untouched', () => {
    expect(errFields('nope')).toEqual({ error: 'nope' });
  });

  it('JSON-stringifies a plain object', () => {
    expect(errFields({ code: 42 })).toEqual({ error: '{"code":42}' });
  });
});

describe('structured logger', () => {
  it('emits an entry with level and message', () => {
    const [entry] = capture(() => logger.info('hello'));
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('hello');
  });

  it('carries the service metadata on the logger instance', () => {
    expect(
      (winstonLogger as unknown as { defaultMeta: Record<string, unknown> }).defaultMeta
    ).toEqual({ service: 'stellar-save-backend' });
  });

  it('merges a fields object into the log entry (structured form)', () => {
    const [entry] = capture(() => logger.warn('with fields', { userId: 'u1', count: 3 }));
    expect(entry.level).toBe('warn');
    expect(entry.userId).toBe('u1');
    expect(entry.count).toBe(3);
  });

  it('accepts a console-style Error second argument', () => {
    const [entry] = capture(() => logger.error('boom', new Error('bad')));
    expect(entry.level).toBe('error');
    expect(entry.message).toBe('boom');
    expect(entry.error).toBe('bad');
    expect(typeof entry.stack).toBe('string');
  });

  it('collapses multiple trailing args into a detail array', () => {
    const [entry] = capture(() => logger.info('multi', 'a', 'b'));
    expect(entry.detail).toEqual(['a', 'b']);
  });

  it('stringifies a non-string first argument', () => {
    const [entry] = capture(() => logger.info({ shape: 'object' } as unknown as string));
    expect(entry.message).toBe('{"shape":"object"}');
  });

  it('exposes the four standard levels and a shared winston instance', () => {
    for (const m of ['debug', 'info', 'warn', 'error'] as const) {
      expect(typeof logger[m]).toBe('function');
    }
    expect(winstonLogger.transports.length).toBeGreaterThanOrEqual(2);
  });

  describe('sensitive data redaction', () => {
    it('redacts sensitive keys such as secret and authorization', () => {
      const [entry] = capture(() =>
        logger.info('user authentication', {
          userId: 'u1',
          secret: 'super-secret-key-value',
          authorization: 'Bearer eyJhbGciOi...',
          password: 'my-plaintext-password',
        })
      );
      expect(entry.secret).toBe('[REDACTED]');
      expect(entry.authorization).toBe('[REDACTED]');
      expect(entry.password).toBe('[REDACTED]');
      expect(entry.userId).toBe('u1');
    });

    it('redacts nested keys within wallet payloads', () => {
      const [entry] = capture(() =>
        logger.info('wallet transaction submit', {
          wallet: {
            address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFTGXDTVWNXRW24DC4TOW',
            secretKey: 'SCVG...SECRET',
            seed: 'sample-seed-phrase',
          },
        })
      );
      expect(entry.wallet.secretKey).toBe('[REDACTED]');
      expect(entry.wallet.seed).toBe('[REDACTED]');
      expect(entry.wallet.address).toBe('GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFTGXDTVWNXRW24DC4TOW');
    });
  });
});
