import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import 'winston-daily-rotate-file';

// ── Winston logger with JSON formatter and daily log rotation ─────────────────

const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const transports: winston.transport[] = [
  // Console transport (stdout/stderr)
  new winston.transports.Console({
    format: jsonFormat,
    stderrLevels: ['error'],
  }),
  // Rotating file transport — one file per day, keep 14 days
  new (winston.transports as any).DailyRotateFile({
    filename: 'logs/app-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
    maxSize: '20m',
    format: jsonFormat,
    zippedArchive: true,
  }),
];

export const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'stellar-save-backend' },
  transports,
});

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => winstonLogger.debug(msg, fields),
  info:  (msg: string, fields?: Record<string, unknown>) => winstonLogger.info(msg, fields),
  warn:  (msg: string, fields?: Record<string, unknown>) => winstonLogger.warn(msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => winstonLogger.error(msg, fields),
};

// ── Lazy Prisma import to avoid circular deps and missing generated client ────
let _prisma: any = null;
function getPrisma(): any {
  if (!_prisma) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PrismaClient } = require('./generated/prisma/client');
      _prisma = new PrismaClient();
    } catch {
      // Prisma client not generated yet (no DB); audit logging silently skipped
    }
  }
  return _prisma;
}

/** Extract wallet address from request (Authorization header or query param). */
function extractWallet(req: Request): string | null {
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Wallet ')) return auth.slice(7).trim();
  const wallet = req.query['wallet'] || req.body?.wallet;
  return wallet ? String(wallet) : null;
}

/**
 * Express middleware — logs every request/response in JSON via Winston
 * and stores an audit record in the audit_logs table.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const walletAddress = extractWallet(req);

    logger.info('http request', {
      method: req.method,
      path: req.path,
      status_code: res.statusCode,
      duration_ms: durationMs,
      wallet_address: walletAddress,
      user_agent: req.headers['user-agent'],
      ip: req.ip,
    });

    // Persist to audit_logs table (non-blocking)
    try {
      const prisma = getPrisma();
      if (prisma) {
        prisma.auditLog.create({
          data: {
            walletAddress,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs,
            ipAddress: req.ip || null,
            userAgent: req.headers['user-agent'] || null,
          },
        }).catch(() => {/* non-blocking */});
      }
    } catch {/* non-blocking */}
  });

  next();
}
