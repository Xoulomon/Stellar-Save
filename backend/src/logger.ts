import { Request, Response, NextFunction } from 'express';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  '@timestamp': string;
  level: LogLevel;
  message: string;
  service: string;
  [key: string]: unknown;
}

function write(level: LogLevel, message: string, fields: Record<string, unknown> = {}): void {
  const entry: LogEntry = {
    '@timestamp': new Date().toISOString(),
    level,
    message,
    service: 'stellar-save-backend',
    ...fields,
  };
  const out = level === 'error' ? process.stderr : process.stdout;
  out.write(JSON.stringify(entry) + '\n');
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => write('debug', msg, fields),
  info:  (msg: string, fields?: Record<string, unknown>) => write('info',  msg, fields),
  warn:  (msg: string, fields?: Record<string, unknown>) => write('warn',  msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write('error', msg, fields),
};

/** Express middleware — logs every request/response in ELK-compatible JSON. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('http request', {
      method: req.method,
      path: req.path,
      status_code: res.statusCode,
      duration_ms: Date.now() - start,
      user_agent: req.headers['user-agent'],
      ip: req.ip,
    });
  });
  next();
}
