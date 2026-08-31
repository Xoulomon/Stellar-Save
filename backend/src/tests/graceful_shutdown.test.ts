import { createGracefulShutdown } from '../graceful_shutdown';

function makeServer(closeDelayMs: number) {
  return {
    close: jest.fn((cb: (err?: Error) => void) => {
      setTimeout(() => cb(), closeDelayMs);
    }),
  };
}

describe('createGracefulShutdown', () => {
  it('waits for in-flight requests to finish before running cleanup and exiting', async () => {
    const server = makeServer(30);
    const cleanup = jest.fn().mockResolvedValue(undefined);
    const exit = jest.fn();

    const shutdown = createGracefulShutdown(server, cleanup, { timeoutMs: 1000, exit, log: () => {} });
    shutdown('SIGTERM');

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(cleanup).not.toHaveBeenCalled();

    await new Promise(resolve => setTimeout(resolve, 60));

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('forces exit if in-flight requests do not finish within the timeout', async () => {
    const server = makeServer(10_000); // never resolves within the test window
    const cleanup = jest.fn().mockResolvedValue(undefined);
    const exit = jest.fn();

    const shutdown = createGracefulShutdown(server, cleanup, {
      timeoutMs: 20,
      exit,
      log: () => {},
      logError: () => {},
    });
    shutdown('SIGTERM');

    await new Promise(resolve => setTimeout(resolve, 40));

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('ignores repeated shutdown signals', () => {
    const server = makeServer(10);
    const cleanup = jest.fn().mockResolvedValue(undefined);
    const exit = jest.fn();

    const shutdown = createGracefulShutdown(server, cleanup, { timeoutMs: 1000, exit, log: () => {} });
    shutdown('SIGTERM');
    shutdown('SIGINT');

    expect(server.close).toHaveBeenCalledTimes(1);
  });
});
