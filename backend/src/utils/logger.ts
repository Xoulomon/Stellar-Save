/**
 * Shared structured logger for all backend services.
 *
 * Emits newline-delimited JSON (one JSON object per line) so that the ELK
 * stack in `monitoring/elk` can ingest logs without custom parsing rules.
 *
 * Usage:
 *   import { logger } from './utils/logger';
 *   logger.info('server started', { port: 3000 });
 */

import { config } from '../config';
import { getCorrelationId } from '../middleware/requestContext';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  [key: string]: unknown;
}

export interface LogEntry {
  '@timestamp': string;
  level: LogLevel;
  message: string;
  service: string;
  environment: string;
  correlation_id?: string;
  [key: string]: unknown;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveMinLevel(): LogLevel {
  const configured = config.logging.level.toLowerCase();
  if (configured in LEVEL_WEIGHT) {
    return configured as LogLevel;
  }
  return 'info';
}

const SERVICE_NAME = config.serviceName;
const ENVIRONMENT = config.nodeEnv;
const MIN_LEVEL = resolveMinLevel();

function serializeError(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  return value;
}

function normalizeFields(fields: LogFields): LogFields {
  const normalized: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    normalized[key] = serializeError(value);
  }
  return normalized;
}

function write(level: LogLevel, message: string, fields: LogFields = {}): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[MIN_LEVEL]) {
    return;
  }

  const entry: LogEntry = {
    '@timestamp': new Date().toISOString(),
    level,
    message,
    service: SERVICE_NAME,
    environment: ENVIRONMENT,
  };

  const correlationId = getCorrelationId();
  if (correlationId) {
    entry.correlation_id = correlationId;
  }

  Object.assign(entry, normalizeFields(fields));

  const line = JSON.stringify(entry) + '\n';

  if (level === 'error') {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write('debug', message, fields),
  info: (message: string, fields?: LogFields) => write('info', message, fields),
  warn: (message: string, fields?: LogFields) => write('warn', message, fields),
  error: (message: string, fields?: LogFields) => write('error', message, fields),
};

export default logger;
