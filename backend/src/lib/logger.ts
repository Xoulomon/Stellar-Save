import winston from 'winston';

import 'winston-daily-rotate-file';
import { config } from '../config';
import { attachCorrelationId, getCorrelationId } from './requestContext';

import type { Request, Response, NextFunction } from 'express';

// ── Winston logger with JSON formatter and daily log rotation ─────────────────

const SENSITIVE_KEY_REGEX =
  /(secret|authorization|password|token|api_?key|private_?key|seed|credential)/i;

/**
 * Deeply redact sensitive keys (such as `secret`, `authorization`, private keys, etc.)
 * in metadata objects and wallet payloads before logging.
 */
export function redactSensitive<T>(value: T, depth = 0): T {
  if (depth > 10 || value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1)) as unknown as T;
  }
  if (
    typeof value === 'object' &&
    !(value instanceof Error) &&
    !(value instanceof Date) &&
    !(value instanceof RegExp)
  ) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY_REGEX.test(k)) {
        result[k] = '[REDACTED]';
      } else if (typeof v === 'object' && v !== null) {
        result[k] = redactSensitive(v, depth + 1);
      } else {
        result[k] = v;
      }
    }
    return result as unknown as T;
  }
  return value;
}

const redactFormat = winston.format((info) => redactSensitive(info))();

const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format((info) => {
    info['@timestamp'] = info.timestamp;
    const correlationId = getCorrelationId();
    if (correlationId && info.correlation_id === undefined) {
      info.correlation_id = correlationId;
    }
    return info;
  })(),
  redactFormat,
  winston.format.json()
);

const transports: winston.transport[] = [
  // Console transport (stdout/stderr)
  new winston.transports.Console({
    format: jsonFormat,
    stderrLevels: ['error'],
  }),
  // Rotating file transport — one file per day, keep 14 days
  new (
    winston.transports as unknown as { DailyRotateFile: new (opts: unknown) => winston.transport }
  ).DailyRotateFile({
    filename: 'logs/app-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
    maxSize: '20m',
    format: jsonFormat,
    zippedArchive: true,
  }),
];

export const winstonLogger = winston.createLogger({
  level: config.logging.level,
  defaultMeta: { service: 'stellar-save-backend' },
  format: redactFormat,
  transports,
});

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Normalise an unknown thrown value into structured log fields.
 * Keeps `logger.error('...', errFields(err))` call sites terse.
 */
export function errFields(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { error: err.message, stack: err.stack };
  }
  return { error: typeof err === 'string' ? err : safeStringify(err) };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Coerce the trailing arguments of a `logger.*` call into a single structured
 * metadata object. This lets call sites use either the structured form
 * (`logger.info('msg', { a: 1 })`) or a console-style form
 * (`logger.error('msg', err)` / `logger.info('a', 'b')`) without losing JSON
 * structure in the emitted log line.
 */
function toMeta(rest: unknown[]): Record<string, unknown> | undefined {
  if (rest.length === 0) return undefined;
  let meta: Record<string, unknown> | undefined;
  if (rest.length === 1) {
    const [only] = rest;
    if (only === undefined || only === null) return undefined;
    if (only instanceof Error) meta = errFields(only);
    else if (typeof only === 'object') meta = only as Record<string, unknown>;
    else meta = { detail: only };
  } else {
    meta = {
      detail: rest.map((r) => (r instanceof Error ? (r.stack ?? r.message) : r)),
    };
  }
  return meta ? (redactSensitive(meta) as Record<string, unknown>) : undefined;
}

function emit(level: LogLevel, msg: unknown, rest: unknown[]): void {
  const message =
    typeof msg === 'string'
      ? msg
      : msg instanceof Error
        ? (msg.stack ?? msg.message)
        : safeStringify(msg);
  winstonLogger.log(level, message, toMeta(rest));
}

/**
 * Structured application logger. Prefer the `(message, fields)` form so log
 * aggregation can query on individual fields.
 */
export const logger = {
  debug: (msg: unknown, ...rest: unknown[]) => emit('debug', msg, rest),
  info: (msg: unknown, ...rest: unknown[]) => emit('info', msg, rest),
  warn: (msg: unknown, ...rest: unknown[]) => emit('warn', msg, rest),
  error: (msg: unknown, ...rest: unknown[]) => emit('error', msg, rest),
};

let consoleBridgeInstalled = false;

function formatConsoleArg(value: unknown): string {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Safety net for third-party code (and any stragglers) that still call
 * `console.*` — routes them through Winston so nothing bypasses structured
 * logging. First-party code should import `logger` directly.
 */
function installConsoleBridge(): void {
  if (consoleBridgeInstalled) return;
  consoleBridgeInstalled = true;

  const bridge =
    (level: LogLevel) =>
    (...args: unknown[]) => {
      const [first, ...rest] = args;
      const message = [first, ...rest].map(formatConsoleArg).join(' ');
      winstonLogger.log(level, message);
    };

  /* eslint-disable no-console -- logger module: intentionally patches console */
  console.log = bridge('info');
  console.info = bridge('info');
  console.warn = bridge('warn');
  console.error = bridge('error');
  console.debug = bridge('debug');
  /* eslint-enable no-console */
}

if (config.nodeEnv !== 'test') {
  installConsoleBridge();
}

// ── Lazy prisma import — avoids circular dep (logger ← prisma_client ← logger) ─
type AuditPrisma = {
  auditLog: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
};

let _prisma: AuditPrisma | null = null;
async function getPrisma(): Promise<AuditPrisma | null> {
  if (!_prisma) {
    try {
      const { prisma } = await import('../prisma_client');
      _prisma = prisma as unknown as AuditPrisma;
    } catch {
      // prisma_client unavailable; audit logging silently skipped
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
 *
 * Correlation-id assignment lives in `middleware/requestId.ts`; this
 * middleware reuses an already-attached id when present and falls back to
 * attaching one so it remains usable standalone. The request context
 * (AsyncLocalStorage) is owned by that middleware — this one only reads the
 * id via `getCorrelationId()` in the JSON formatter, so no second scope is
 * created here.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const correlationId = attachCorrelationId(req, res);

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const walletAddress = extractWallet(req);

    logger.info('http request', {
      correlation_id: correlationId,
      method: req.method,
      path: req.path,
      status_code: res.statusCode,
      duration_ms: durationMs,
      wallet_address: walletAddress,
      user_agent: req.headers['user-agent'],
      ip: req.ip,
    });

    // Persist to audit_logs table (non-blocking)
    getPrisma()
      .then((prisma) => {
        if (prisma) {
          prisma.auditLog
            .create({
              data: {
                walletAddress,
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                durationMs,
                ipAddress: req.ip || null,
                userAgent: req.headers['user-agent'] || null,
              },
            })
            .catch(() => {
              /* non-blocking */
            });
        }
      })
      .catch(() => {
        /* non-blocking */
      });
  });

  next();
}
