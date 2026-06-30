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

// ── Cache counters ────────────────────────────────────────────────────────────
export const cacheHitsTotal = new Counter({
  name: 'cache_hits_total',
  help: 'Total cache hits',
  labelNames: ['cache'],
  registers: [registry],
});

export const cacheMissesTotal = new Counter({
  name: 'cache_misses_total',
  help: 'Total cache misses',
  labelNames: ['cache'],
  registers: [registry],
});

export const cacheStaleReadsTotal = new Counter({
  name: 'cache_stale_reads_total',
  help: 'Total stale cache reads detected after invalidation',
  labelNames: ['cache'],
  registers: [registry],
});

export const cacheInvalidationsTotal = new Counter({
  name: 'cache_invalidations_total',
  help: 'Total cache key invalidations triggered by contract events',
  labelNames: ['event_type'],
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

export const apiRequestDuration = new Histogram({
  name: 'api_request_duration_seconds',
  help: 'API request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [registry],
});

export const sorobanRpcCallsTotal = new Counter({
  name: 'soroban_rpc_calls_total',
  help: 'Total Soroban RPC calls made',
  labelNames: ['method', 'status'],
  registers: [registry],
});

export const eventsIndexedTotal = new Counter({
  name: 'events_indexed_total',
  help: 'Total contract events indexed',
  labelNames: ['event_type'],
  registers: [registry],
});

// ── IPFS Metrics ──────────────────────────────────────────────────────────────
export const ipfsPinsTotal = new Counter({
  name: 'ipfs_pins_total',
  help: 'Total IPFS pin operations',
  labelNames: ['action', 'status'],
  registers: [registry],
});

export const ipfsPinsActive = new Gauge({
  name: 'ipfs_pins_active',
  help: 'Number of active IPFS pins tracked',
  registers: [registry],
});

export const ipfsQueueDepth = new Gauge({
  name: 'ipfs_queue_depth',
  help: 'Current IPFS pinning queue depth',
  labelNames: ['state'],
  registers: [registry],
});

export const ipfsNodeHealthy = new Gauge({
  name: 'ipfs_node_healthy',
  help: 'IPFS node health status (1 = healthy, 0 = unhealthy)',
  registers: [registry],
});

export const ipfsAddDuration = new Histogram({
  name: 'ipfs_add_duration_seconds',
  help: 'Duration of IPFS add operations in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
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
    apiRequestDuration.observe(labels, durationSec);
    activeConnections.dec();
  });

  next();
}

// ── /metrics handler ──────────────────────────────────────────────────────────
export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
}
