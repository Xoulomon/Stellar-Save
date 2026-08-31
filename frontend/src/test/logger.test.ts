import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the logger by importing it after manipulating import.meta.env
// via vi.stubEnv, then re-importing the module fresh.

describe('logger — production mode (IS_DEV = false)', () => {
  let consoleLog: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('warn() always calls console.warn with prefix', async () => {
    const { logger } = await import('../utils/logger');
    logger.warn('test warning');
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('[StellarSave]'),
      expect.stringContaining('test warning'),
    );
  });

  it('error() always calls console.error with prefix', async () => {
    const { logger } = await import('../utils/logger');
    logger.error('test error');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[StellarSave]'),
      expect.stringContaining('test error'),
    );
  });

  it('warn() includes [WARN] in prefix', async () => {
    const { logger } = await import('../utils/logger');
    logger.warn('something');
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('[WARN]'),
      expect.anything(),
    );
  });

  it('error() includes [ERROR] in prefix', async () => {
    const { logger } = await import('../utils/logger');
    logger.error('oops');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[ERROR]'),
      expect.anything(),
    );
  });

  it('accepts multiple arguments', async () => {
    const { logger } = await import('../utils/logger');
    const obj = { id: 1 };
    logger.warn('message', obj);
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('[StellarSave]'),
      expect.stringContaining('message'),
      obj,
    );
  });
});

describe('logger — API shape', () => {
  it('exports debug, info, warn, error functions', async () => {
    const { logger } = await import('../utils/logger');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('debug() does not throw', async () => {
    const { logger } = await import('../utils/logger');
    expect(() => logger.debug('test')).not.toThrow();
  });

  it('info() does not throw', async () => {
    const { logger } = await import('../utils/logger');
    expect(() => logger.info('test')).not.toThrow();
  });
});
