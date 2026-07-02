/**
 * audit_event_log.ts
 *
 * Tamper-evident, append-only event-sourcing audit log (Issue #1).
 *
 * Design
 * ──────
 * Each audit entry records the actor, action, resource, before/after state
 * summary and carries a SHA-256 hash chain so any modification to a
 * historical record is detectable:
 *
 *   entry.hash = SHA-256( prevHash | id | actor | action | resourceType |
 *                         resourceId | before | after | timestamp )
 *
 * Entries are INSERT-only (no UPDATE/DELETE paths are exposed).  An
 * integrity-verification job re-computes and compares the chain at any time.
 *
 * Admin query endpoint: GET /api/admin/audit-log
 *   • filter by actor, action, resourceType, resourceId, date range
 *   • paginated (limit/offset)
 *
 * Exports
 * ───────
 *   AuditEventLog.record()        — write one entry
 *   AuditEventLog.verify()        — verify full chain integrity
 *   createAuditRouter()           — Express router for admin queries
 *   auditMiddleware()             — Express middleware that auto-records
 *                                   state-changing HTTP operations
 */

import crypto from 'crypto';
import { Request, Response, NextFunction, Router } from 'express';
import { prisma } from './prisma_client';
import { logger } from './logger';
import { adminAuthMiddleware, AuthenticatedRequest } from './auth_middleware';
import { Gauge, Counter } from 'prom-client';
import { registry } from './metrics';

// ── Prometheus metrics ────────────────────────────────────────────────────────

export const auditEntriesTotal = new Counter({
  name: 'audit_entries_total',
  help: 'Total audit log entries written',
  labelNames: ['action'],
  registers: [registry],
});

export const auditChainViolations = new Gauge({
  name: 'audit_chain_violations',
  help: 'Number of hash-chain violations detected by the last integrity check',
  registers: [registry],
});

export const auditLastVerifiedTs = new Gauge({
  name: 'audit_last_verified_timestamp_seconds',
  help: 'Unix timestamp of the last successful full chain verification',
  registers: [registry],
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuditRecordInput {
  /** Wallet address or system identifier of who performed the action */
  actor: string;
  /** Verb describing the operation e.g. "group.create", "contribution.submit" */
  action: string;
  /** Model/table name e.g. "Group", "ContractEvent" */
  resourceType: string;
  /** Primary key / contract ID of the affected record */
  resourceId?: string;
  /** Snapshot of relevant fields before the change (null for creates) */
  before?: Record<string, unknown> | null;
  /** Snapshot of relevant fields after the change (null for deletes) */
  after?: Record<string, unknown> | null;
  /** Optional arbitrary metadata */
  metadata?: Record<string, unknown>;
}

export interface AuditEntry extends AuditRecordInput {
  id: string;
  prevHash: string;
  hash: string;
  createdAt: Date;
}

export interface VerificationResult {
  ok: boolean;
  totalChecked: number;
  violations: Array<{ id: string; expected: string; actual: string; position: number }>;
  checkedAt: Date;
}

// ── Hash computation ──────────────────────────────────────────────────────────

function computeHash(
  id: string,
  prevHash: string,
  actor: string,
  action: string,
  resourceType: string,
  resourceId: string,
  before: string,
  after: string,
  createdAt: string,
): string {
  const payload = [id, prevHash, actor, action, resourceType, resourceId, before, after, createdAt].join('|');
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

// ── AuditEventLog service ─────────────────────────────────────────────────────

export class AuditEventLog {
  /**
   * Append one audit entry.  Resolves the previous entry's hash to build the
   * chain.  The database INSERT uses a serialisable transaction so no two
   * concurrent writes can race on the same prevHash value.
   */
  static async record(input: AuditRecordInput): Promise<AuditEntry> {
    return (prisma as any).$transaction(
      async (tx: any) => {
        // Find the latest entry to chain from
        const latest = await tx.auditEventLog.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { id: true, hash: true, createdAt: true },
        });

        const prevHash = latest?.hash ?? GENESIS_HASH;
        const id = crypto.randomUUID();
        const now = new Date();

        const beforeStr = JSON.stringify(input.before ?? null);
        const afterStr = JSON.stringify(input.after ?? null);
        const resourceId = input.resourceId ?? '';

        const hash = computeHash(
          id,
          prevHash,
          input.actor,
          input.action,
          input.resourceType,
          resourceId,
          beforeStr,
          afterStr,
          now.toISOString(),
        );

        const entry = await tx.auditEventLog.create({
          data: {
            id,
            actor: input.actor,
            action: input.action,
            resourceType: input.resourceType,
            resourceId: resourceId || null,
            before: input.before ?? undefined,
            after: input.after ?? undefined,
            metadata: input.metadata ?? undefined,
            prevHash,
            hash,
            createdAt: now,
          },
        });

        auditEntriesTotal.inc({ action: input.action });
        return entry as AuditEntry;
      },
      { isolationLevel: 'Serializable' },
    );
  }

  /**
   * Verify the integrity of the full chain in ascending order.
   * Re-computes each entry's hash from its stored fields and compares against
   * the persisted hash.  Also verifies each entry's prevHash matches the hash
   * of the preceding entry.
   *
   * Designed to run as a periodic background job.
   */
  static async verify(limit = 100_000): Promise<VerificationResult> {
    const entries = await (prisma as any).auditEventLog.findMany({
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
        id: true,
        actor: true,
        action: true,
        resourceType: true,
        resourceId: true,
        before: true,
        after: true,
        prevHash: true,
        hash: true,
        createdAt: true,
      },
    });

    const violations: VerificationResult['violations'] = [];
    let expectedPrev = GENESIS_HASH;

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];

      // Verify prevHash linkage
      if (e.prevHash !== expectedPrev) {
        violations.push({
          id: e.id,
          expected: expectedPrev,
          actual: e.prevHash,
          position: i,
        });
      }

      // Re-compute hash from stored fields
      const recomputed = computeHash(
        e.id,
        e.prevHash,
        e.actor,
        e.action,
        e.resourceType,
        e.resourceId ?? '',
        JSON.stringify(e.before ?? null),
        JSON.stringify(e.after ?? null),
        new Date(e.createdAt).toISOString(),
      );

      if (recomputed !== e.hash) {
        violations.push({
          id: e.id,
          expected: recomputed,
          actual: e.hash,
          position: i,
        });
      }

      expectedPrev = e.hash;
    }

    const result: VerificationResult = {
      ok: violations.length === 0,
      totalChecked: entries.length,
      violations,
      checkedAt: new Date(),
    };

    auditChainViolations.set(violations.length);

    if (!result.ok) {
      logger.error('[AuditEventLog] Chain integrity violations detected', {
        count: violations.length,
        sample: violations.slice(0, 5),
      });
    } else {
      auditLastVerifiedTs.set(Date.now() / 1000);
      logger.info('[AuditEventLog] Chain integrity OK', { totalChecked: entries.length });
    }

    return result;
  }

  /**
   * Periodic integrity-verification job.  Call this from index.ts.
   * Runs every `intervalMs` milliseconds (default: 1 hour).
   */
  static startVerificationJob(intervalMs = 60 * 60 * 1000): NodeJS.Timeout {
    logger.info('[AuditEventLog] Integrity verification job started', { intervalMs });

    const run = async () => {
      try {
        await AuditEventLog.verify();
      } catch (err) {
        logger.error('[AuditEventLog] Verification job error', { error: String(err) });
      }
    };

    // Run once immediately on startup, then on interval
    void run();
    return setInterval(run, intervalMs);
  }
}

// ── Express middleware — auto-record state-changing API operations ─────────────

/** HTTP methods that represent state changes */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Attach to any router or globally to auto-write an audit entry for every
 * state-changing HTTP request that completes with a 2xx or 3xx status.
 *
 * The "actor" is extracted from the JWT (req.walletAddress) or the admin
 * identity (req.adminId), falling back to the IP address for unauthenticated
 * requests so every action is attributable.
 *
 * Before/after summaries are deliberately kept small: we capture the request
 * body summary (before) and response status (after) so the log remains
 * audit-quality rather than a full diff, which would require hooking into each
 * service's DB layer individually.
 */
export function auditMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  // Capture request body summary before it might be mutated downstream
  const bodySummary = summariseBody(req.body);

  res.on('finish', () => {
    // Only audit successful mutations
    if (res.statusCode < 200 || res.statusCode >= 400) return;

    const actor = req.walletAddress ?? (req as any).adminId ?? req.ip ?? 'anonymous';
    const action = `${req.method} ${normalisePath(req.path)}`;
    const resourceType = inferResourceType(req.path);
    const resourceId = inferResourceId(req.params);

    AuditEventLog.record({
      actor,
      action,
      resourceType,
      resourceId,
      before: null, // HTTP layer can't capture DB before-state without per-service hooks
      after: {
        status: res.statusCode,
        requestBody: bodySummary,
      },
      metadata: {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    }).catch((err) => {
      logger.error('[AuditEventLog] Failed to record audit entry', { error: String(err) });
    });
  });

  next();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalisePath(p: string): string {
  // Replace UUIDs, cuid-style ids, wallet addresses (G...) and numeric ids with :id
  return p
    .replace(/\/[0-9a-f-]{8,}/gi, '/:id')
    .replace(/\/G[A-Z0-9]{54,}/g, '/:wallet')
    .replace(/\/\d+/g, '/:id');
}

function inferResourceType(path: string): string {
  const segments = path.split('/').filter(Boolean);
  // Skip api, v1, v2 prefix segments
  const meaningful = segments.filter((s) => !['api', 'v1', 'v2'].includes(s));
  return meaningful[0] ?? 'unknown';
}

function inferResourceId(params: Record<string, string>): string | undefined {
  return (
    params.id ??
    params.groupId ??
    params.walletAddress ??
    params.userId ??
    params.keyId ??
    undefined
  );
}

function summariseBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  const obj = body as Record<string, unknown>;
  // Strip sensitive fields
  const REDACTED = new Set(['password', 'secret', 'token', 'signature', 'privateKey', 'mnemonic']);
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([k]) => !REDACTED.has(k))
      .slice(0, 20) // cap to 20 fields
      .map(([k, v]) => [k, typeof v === 'object' ? '[object]' : v]),
  );
}

// ── Admin audit query router ──────────────────────────────────────────────────

/**
 * Mount at /api/admin/audit-log
 * All routes require admin authentication.
 */
export function createAuditRouter(): Router {
  const router = Router();

  // All audit routes require admin auth
  router.use(adminAuthMiddleware);

  /**
   * GET /api/admin/audit-log
   * Query params: actor, action, resourceType, resourceId, from, to, limit, offset
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const {
        actor,
        action,
        resourceType,
        resourceId,
        from,
        to,
        limit: limitStr,
        offset: offsetStr,
      } = req.query as Record<string, string | undefined>;

      const limit = Math.min(parseInt(limitStr ?? '50', 10) || 50, 200);
      const offset = parseInt(offsetStr ?? '0', 10) || 0;

      const where: Record<string, unknown> = {};
      if (actor) where.actor = actor;
      if (action) where.action = { contains: action };
      if (resourceType) where.resourceType = resourceType;
      if (resourceId) where.resourceId = resourceId;
      if (from || to) {
        where.createdAt = {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        };
      }

      const [entries, total] = await Promise.all([
        (prisma as any).auditEventLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        (prisma as any).auditEventLog.count({ where }),
      ]);

      res.json({ total, limit, offset, entries });
    } catch (err) {
      logger.error('[AuditRouter] Query failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to query audit log' });
    }
  });

  /**
   * GET /api/admin/audit-log/verify
   * Runs the hash-chain integrity check on demand and returns the result.
   */
  router.get('/verify', async (_req: Request, res: Response) => {
    try {
      const result = await AuditEventLog.verify();
      res.status(result.ok ? 200 : 409).json(result);
    } catch (err) {
      logger.error('[AuditRouter] Verification failed', { error: String(err) });
      res.status(500).json({ error: 'Verification failed' });
    }
  });

  /**
   * GET /api/admin/audit-log/:id
   * Fetch a single audit entry by ID.
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const entry = await (prisma as any).auditEventLog.findUnique({
        where: { id: req.params.id },
      });
      if (!entry) return res.status(404).json({ error: 'Audit entry not found' });
      res.json(entry);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch audit entry' });
    }
  });

  return router;
}
