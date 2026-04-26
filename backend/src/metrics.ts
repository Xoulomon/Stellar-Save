import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { Request, Response, NextFunction } from 'express';

export const registry = new Registry();
registry.setDefaultLabels({ app: 'stellar-save-backend' });
collectDefaultMetrics({ register: registry });

// ── Counters ──────────────────────────────────────────────────────────────────
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const backupJobsTotal = new Counter({
  name: 'backup_jobs_total',
  help: 'Total backup jobs triggered',
  labelNames: ['type', 'status'],
  registers: [registry],
});

export const exportJobsTotal = new Counter({
  name: 'export_jobs_total',
  help: 'Total export jobs created',
  labelNames: ['format'],
  registers: [registry],
});

// ── Histograms ────────────────────────────────────────────────────────────────
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [registry],
});

// ── Gauges ────────────────────────────────────────────────────────────────────
export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active HTTP connections',
  registers: [registry],
});

export const backupJobsActive = new Gauge({
  name: 'backup_jobs_active',
  help: 'Number of currently running backup jobs',
  registers: [registry],
});

// ── Middleware ────────────────────────────────────────────────────────────────
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  activeConnections.inc();

  res.on('finish', () => {
    const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
    const route = (req.route?.path ?? req.path).replace(/\/[0-9a-f-]{8,}/gi, '/:id');
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationSec);
    activeConnections.dec();
  });

  next();
}

// ── /metrics handler ──────────────────────────────────────────────────────────
export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
}
