import { logger } from './logger';

export interface ShutdownServer {
  close(callback: (err?: Error) => void): void;
}

export interface GracefulShutdownOptions {
  /** Max time to wait for in-flight requests to finish before forcing exit (ms). Default: 10000 */
  timeoutMs?: number;
  exit?: (code: number) => void;
  log?: (msg: string) => void;
  logError?: (msg: string, err?: unknown) => void;
}

/**
 * Builds a signal handler that stops the server from accepting new connections,
 * lets in-flight requests finish (bounded by a timeout), runs cleanup (e.g.
 * closing DB connections), then exits.
 */
export function createGracefulShutdown(
  server: ShutdownServer,
  cleanup: () => Promise<void>,
  options: GracefulShutdownOptions = {}
): (signal: string) => void {
  const timeoutMs = options.timeoutMs ?? 10000;
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const log = options.log ?? ((msg: string) => logger.info(msg));
  const logError = options.logError ?? ((msg: string, err?: unknown) => logger.error(msg, err));
  let isShuttingDown = false;

  return function gracefulShutdown(signal: string): void {
    if (isShuttingDown) return;
    isShuttingDown = true;
    log(`[shutdown] Received ${signal}, draining in-flight requests...`);

    const forceExitTimer = setTimeout(() => {
      logError(`[shutdown] Timed out after ${timeoutMs}ms; forcing exit.`);
      exit(1);
    }, timeoutMs);
    forceExitTimer.unref?.();

    server.close((err?: Error) => {
      cleanup()
        .catch(() => {})
        .finally(() => {
          clearTimeout(forceExitTimer);
          if (err) {
            logError('[shutdown] Error closing server:', err);
            exit(1);
            return;
          }
          log('[shutdown] Clean shutdown complete.');
          exit(0);
        });
    });
  };
}
