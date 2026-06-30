import { logger, winstonLogger } from '../logger';

describe('Winston logger', () => {
  it('exports a logger with required methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('winstonLogger has correct service metadata', () => {
    const meta = (winstonLogger as any).defaultMeta;
    expect(meta).toEqual({ service: 'stellar-save-backend' });
  });

  it('winstonLogger has at least 2 transports (console + file rotation)', () => {
    expect(winstonLogger.transports.length).toBeGreaterThanOrEqual(2);
  });

  it('logs without throwing', () => {
    expect(() => logger.info('test message', { key: 'value' })).not.toThrow();
    expect(() => logger.warn('test warning')).not.toThrow();
    expect(() => logger.error('test error', { err: 'details' })).not.toThrow();
    expect(() => logger.debug('test debug')).not.toThrow();
  });
});
