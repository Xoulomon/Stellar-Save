import { logger, createLogger, LogLevel } from './logger';

describe('logger', () => {
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;
  const originalLevel = process.env.LOG_LEVEL;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    delete process.env.LOG_LEVEL;
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    if (originalLevel === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = originalLevel;
    }
  });

  const parseWritten = (spy: jest.SpyInstance): Record<string, unknown> => {
    expect(spy).toHaveBeenCalledTimes(1);
    const raw = spy.mock.calls[0][0] as string;
    return JSON.parse(raw.trim());
  };

  it('emits structured JSON with level, message and timestamp', () => {
    logger.info('hello world');

    const entry = parseWritten(stdoutSpy);
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('hello world');
    expect(typeof entry.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(entry.timestamp as string))).toBe(false);
  });

  it('merges structured context into the log entry', () => {
    logger.info('request handled', { requestId: 'abc', status: 200 });

    const entry = parseWritten(stdoutSpy);
    expect(entry.requestId).toBe('abc');
    expect(entry.status).toBe(200);
  });

  it('serializes Error objects in context without losing the message', () => {
    const error = new Error('boom');
    logger.error('failed', { error });

    const entry = parseWritten(stderrSpy);
    expect(entry.level).toBe('error');
    expect(entry.message).toBe('failed');
    const serialized = entry.error as Record<string, unknown>;
    expect(serialized.message).toBe('boom');
    expect(typeof serialized.stack).toBe('string');
  });

  it('writes error-level logs to stderr and lower levels to stdout', () => {
    logger.warn('careful');
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    expect(stderrSpy).not.toHaveBeenCalled();

    stdoutSpy.mockClear();
    logger.error('bad');
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('respects LOG_LEVEL and suppresses lower-priority logs', () => {
    process.env.LOG_LEVEL = 'warn';
    const scoped = createLogger();

    scoped.info('ignored');
    expect(stdoutSpy).not.toHaveBeenCalled();

    scoped.warn('shown');
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to info level for invalid LOG_LEVEL values', () => {
    process.env.LOG_LEVEL = 'not-a-level';
    const scoped = createLogger();

    scoped.debug('ignored');
    expect(stdoutSpy).not.toHaveBeenCalled();

    scoped.info('shown');
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
  });

  it('binds base context from createLogger into every entry', () => {
    const scoped = createLogger({ service: 'api' });
    scoped.info('started', { port: 3000 });

    const entry = parseWritten(stdoutSpy);
    expect(entry.service).toBe('api');
    expect(entry.port).toBe(3000);
  });

  it('exposes the LogLevel enum for callers', () => {
    expect(LogLevel.Debug).toBe('debug');
    expect(LogLevel.Info).toBe('info');
    expect(LogLevel.Warn).toBe('warn');
    expect(LogLevel.Error).toBe('error');
  });
});
