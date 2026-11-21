import { Horizon } from '@stellar/stellar-sdk';

import { PrismaClient } from './generated/prisma/client';
import { GroupStateCache, isStateMutatingEvent } from './lib/cache';
import { fetchWithCorrelationId } from './lib/http';
import { logger } from './logger';
import { eventsIndexedTotal, sorobanRpcCallsTotal } from './metrics';
import { CONTRACT_EVENT_TOPICS } from '../../packages/events-schema/generated/events';

import type { WebPushService } from './web_push_service';

// Typed topic constants — must exist in the canonical schema
const PAYOUT_EVENT_TYPES: string[] = ['payout_executed'];
const MISSED_CONTRIBUTION_TYPES: string[] = ['contribution_missed'];

// Fail fast if topics drift from the canonical schema
const unknownTopics = [...PAYOUT_EVENT_TYPES, ...MISSED_CONTRIBUTION_TYPES].filter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- CONTRACT_EVENT_TOPICS is string[], the cast narrows the filter predicate
  (t) => !CONTRACT_EVENT_TOPICS.includes(t as any)
);
if (unknownTopics.length) {
  throw new Error(`[contract_event_indexer] Unknown event topics: ${unknownTopics.join(', ')}`);
}

function isPayout(eventType: string): boolean {
  return PAYOUT_EVENT_TYPES.includes(eventType);
}

function isMissedContribution(eventType: string): boolean {
  return MISSED_CONTRIBUTION_TYPES.includes(eventType.toLowerCase().replace(/-/g, '_'));
}

// Minimal shape of a Horizon Soroban contract event record
interface HorizonEventRecord {
  type?: string;
  eventType?: string;
  topic?: unknown[];
  data?: Record<string, unknown>;
  contractId?: string;
  transactionHash?: string;
  txHash?: string;
  ledger?: number;
  ledgerSeq?: number;
  createdAt?: string;
  paging_token?: string;
}

// ── Pipeline stage primitives ────────────────────────────────────────────────
// Each stage is a pure-ish unit of work with a single input and output so the
// indexer can be composed, tested and reasoned about in isolation.

export interface PipelineStage<TIn, TOut> {
  readonly name: string;
  run(input: TIn): Promise<TOut>;
}

/** A decoded, normalised event ready for persistence and emission. */
export interface NormalisedEvent {
  contractId: string;
  eventType: string;
  topics: unknown[];
  data: Record<string, unknown>;
  txHash?: string;
  ledgerSeq?: number;
  timestamp: Date;
  blockTime: Date;
  pagingToken?: string;
  /** Original Horizon record, retained for notification payloads. */
  raw: HorizonEventRecord;
}

/** Result of the fetch stage for a single poll iteration. */
export interface FetchResult {
  records: HorizonEventRecord[];
  nextCursor: string;
}

/** Result of the persist stage for a single event. */
export interface PersistedEvent {
  event: NormalisedEvent;
  stored: {
    contractId: string;
    eventType: string;
    txHash?: string | null;
    ledgerSeq?: number | null;
    timestamp: Date;
    data: Record<string, unknown>;
  };
}

// Extract member addresses from Stellar contract event topics/data
function extractMemberAddresses(event: HorizonEventRecord): string[] {
  const addresses: string[] = [];

  const topicsArr: unknown[] = Array.isArray(event.topic) ? event.topic : [];
  for (const t of topicsArr) {
    if (typeof t === 'string' && t.startsWith('G')) addresses.push(t);
    else if (typeof t === 'object' && t !== null && 'address' in t)
      addresses.push((t as { address: string }).address);
  }

  const data = event.data ?? {};
  for (const key of ['member', 'recipient', 'address', 'sender']) {
    if (typeof data[key] === 'string') addresses.push(data[key] as string);
  }

  return [...new Set(addresses)];
}

/**
 * Normalise a raw Horizon record into the canonical event shape. Pure function
 * so it can be unit tested without any I/O.
 */
export function decodeEventRecord(
  record: HorizonEventRecord,
  fallbackContractId: string
): NormalisedEvent {
  const createdAt = record.createdAt ? new Date(record.createdAt) : new Date();
  return {
    contractId: record.contractId || fallbackContractId,
    eventType: record.type || record.eventType || 'unknown',
    topics: record.topic || [],
    data: record.data || {},
    txHash: record.transactionHash || record.txHash,
    ledgerSeq: record.ledger || record.ledgerSeq,
    timestamp: createdAt,
    blockTime: createdAt,
    pagingToken: record.paging_token,
    raw: record,
  };
}

/**
 * Validate a normalised event against the canonical schema. Unknown event
 * types are rejected so drift is surfaced rather than silently persisted.
 */
export function validateEvent(event: NormalisedEvent): NormalisedEvent {
  const normalised = event.eventType.toLowerCase().replace(/-/g, '_');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- CONTRACT_EVENT_TOPICS is string[], the cast narrows the predicate
  if (!CONTRACT_EVENT_TOPICS.includes(normalised as any)) {
    throw new Error(`[contract_event_indexer] Unknown event topic: ${event.eventType}`);
  }
  return event;
}

export class ContractEventIndexer {
  private server: Horizon.Server;
  private prisma: PrismaClient;
  private contractId: string;
  private isRunning = false;
  private webPush?: WebPushService;

  constructor(
    horizonUrl: string,
    contractId: string,
    databaseUrl: string,
    webPush?: WebPushService
  ) {
    this.server = new Horizon.Server(horizonUrl);
    this.contractId = contractId;
    this.prisma = databaseUrl
      ? new PrismaClient({ datasources: { db: { url: databaseUrl } } })
      : new PrismaClient();
    this.webPush = webPush;
  }

  async start(lastLedger?: number) {
    if (this.isRunning) {
      logger.info('Indexer is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting contract event indexer...');

    try {
      const startLedger = lastLedger ?? (await this.loadStartLedger());
      this.streamEvents(startLedger).catch((err) => {
        logger.error('Fatal error in stream loop:', err);
        this.isRunning = false;
      });
    } catch (error) {
      logger.error('Error starting indexer:', error);
      this.isRunning = false;
    }
  }

  async stop() {
    this.isRunning = false;
    await this.prisma.$disconnect();
    logger.info('Indexer stopped');
  }

  async getEvents(options: {
    contractId?: string;
    eventType?: string;
    startLedger?: number;
    endLedger?: number;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};

    if (options.contractId) where.contractId = options.contractId;
    if (options.eventType) where.eventType = options.eventType;
    if (options.startLedger || options.endLedger) {
      where.ledgerSeq = {};
      if (options.startLedger)
        (where.ledgerSeq as Record<string, unknown>).gte = options.startLedger;
      if (options.endLedger) (where.ledgerSeq as Record<string, unknown>).lte = options.endLedger;
    }
    if (options.startTime || options.endTime) {
      where.timestamp = {};
      if (options.startTime) (where.timestamp as Record<string, unknown>).gte = options.startTime;
      if (options.endTime) (where.timestamp as Record<string, unknown>).lte = options.endTime;
    }

    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const [events, total] = await Promise.all([
      this.prisma.contractEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.contractEvent.count({ where }),
    ]);

    return { events, total, limit, offset };
  }

  // ── Pipeline stages ──────────────────────────────────────────────────────────

  /** Stage 1: fetch a page of events from Horizon for the given cursor. */
  private readonly fetchStage: PipelineStage<string, FetchResult> = {
    name: 'fetch',
    run: async (cursor: string): Promise<FetchResult> => {
      const url = new URL('/events', this.server.serverURL.toString());
      url.searchParams.set('contract', this.contractId);
      url.searchParams.set('startLedger', cursor);
      url.searchParams.set('order', 'asc');
      url.searchParams.set('limit', String(PAGE_LIMIT));

      // Guarded by the Horizon breaker so a degraded endpoint backs the poll
      // loop off immediately instead of burning the full request timeout on
      // every iteration (#1511).
      const data: Record<string, unknown> = await withHorizonCircuit(async () => {
        const response = await fetchWithCorrelationId(url.toString());
        sorobanRpcCallsTotal.inc({
          method: 'getEvents',
          status: response.ok ? 'success' : 'error',
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} from ${url}`);
        }
        return response.json();
      });
      const records: HorizonEventRecord[] =
        (data._embedded as { records?: HorizonEventRecord[] })?.records ?? [];
      const nextCursor =
        records.length > 0 ? records[records.length - 1].paging_token ?? cursor : cursor;
      return { records, nextCursor };
    },
  };

  /** Stage 2: decode raw Horizon records into normalised events. */
  private readonly decodeStage: PipelineStage<HorizonEventRecord[], NormalisedEvent[]> = {
    name: 'decode',
    run: async (records) => records.map((r) => decodeEventRecord(r, this.contractId)),
  };

  /** Stage 3: validate normalised events against the canonical schema. */
  private readonly validateStage: PipelineStage<NormalisedEvent[], NormalisedEvent[]> = {
    name: 'validate',
    run: async (events) => events.map((e) => validateEvent(e)),
  };

  /** Stage 4: persist a single normalised event to Prisma. */
  private readonly persistStage: PipelineStage<NormalisedEvent, PersistedEvent> = {
    name: 'persist',
    run: async (event) => {
      const stored = await withSpan(
        'indexer.db.insert_event',
        {
          'db.system': 'postgresql',
          'db.operation': 'insert',
          'event.type': event.eventType,
        },
        () =>
          this.prisma.contractEvent.create({
            data: {
              contractId: event.contractId,
              eventType: event.eventType,
              topics: event.topics,
              data: event.data,
              txHash: event.txHash,
              ledgerSeq: event.ledgerSeq,
              timestamp: event.timestamp,
              blockTime: event.blockTime,
            },
          })
      );
      logger.info(`Stored event: ${event.eventType} in ledger ${event.ledgerSeq}`);
      eventsIndexedTotal.inc({ event_type: event.eventType });
      return { event, stored };
    },
  };

  /** Stage 5: emit side effects (cache invalidation, webhooks, reputation). */
  private readonly emitStage: PipelineStage<PersistedEvent, void> = {
    name: 'emit',
    run: async ({ event, stored }) => {
      // Bust cache for state-mutating events
      if (isStateMutatingEvent(stored.eventType)) {
        const groupId = this.extractGroupId(stored.data);
        if (groupId) {
          await GroupStateCache.invalidate(stored.contractId, String(groupId), stored.eventType);
        } else {
          await GroupStateCache.invalidateContract(stored.contractId, stored.eventType);
        }
      }

      // Deliver signed webhook notifications for group events
      const webhookEvent = this.mapToWebhookEvent(stored.eventType);
      if (webhookEvent) {
        const groupId = this.extractGroupId(stored.data);
        deliverWebhookEvent(
          webhookEvent,
          {
            contractId: stored.contractId,
            txHash: stored.txHash,
            ledgerSeq: stored.ledgerSeq,
            timestamp: stored.timestamp.toISOString(),
            data: stored.data,
          },
          groupId
        ).catch(() => {
          /* non-blocking */
        });
      }

      // Update member reputation for contribution events
      if (webhookEvent === 'contribution.created') {
        const data = stored.data as Record<string, unknown>;
        const memberAddress = (data?.['member'] ?? data?.['address']) as string | undefined;
        if (memberAddress) {
          // Treat all indexed contributions as on-time (late detection requires cycle data)
          recordContribution(String(memberAddress), true).catch(() => {
            /* non-blocking */
          });
        }
      }

      // Push notifications (best-effort, non-blocking on failure)
      await this.notifyOnEvent(event.raw);
    },
  };

  /** Process a single page of records through decode → validate → persist → emit. */
  private async processRecords(records: HorizonEventRecord[]): Promise<void> {
    const decoded = await this.decodeStage.run(records);
    const validated = await this.validateStage.run(decoded);
    for (const event of validated) {
      const persisted = await this.persistStage.run(event);
      await this.emitStage.run(persisted);
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async streamEvents(startLedger: number): Promise<void> {
    const stored = await this.loadCursorRecord();
    // Use the persisted paging token if available; otherwise fall back to the
    // startLedger sequence number (Horizon accepts ledger seq as a cursor).
    let cursor: string = stored?.lastCursor || String(startLedger);

    logger.info(`[ContractEventIndexer] Starting from cursor=${cursor}`);

    while (this.isRunning) {
      // Each poll iteration is its own root span. Event-handling work below
      // becomes a child span so latency of fetch vs. DB write is visible.
      // The span resolves to the number of ms to wait before the next poll.
      const delayMs = await withSpan(
        'indexer.poll',
        { 'indexer.contract_id': this.contractId, 'indexer.cursor': cursor },
        async (span): Promise<number> => {
          const { records, nextCursor } = await this.fetchStage.run(cursor);
          span.setAttribute('indexer.records', records.length);

          // No new events — idle until the next poll interval.
          if (records.length === 0) {
            return POLL_INTERVAL_MS;
          }

          await withSpan(
            'indexer.process_events',
            { 'indexer.records': records.length },
            () => this.processRecords(records)
          );

          // Update cursor to the last processed event and keep draining (no delay).
          cursor = nextCursor;
          return 0;
        }
      ).catch((error) => {
        logger.error('[ContractEventIndexer] Poll error:', error);
        return ERROR_BACKOFF_MS;
      });

      if (delayMs > 0) await this.delay(delayMs);
    }
  }

  /** Load the persisted cursor for this contract, returning null if none stored. */
  private async loadCursorRecord(): Promise<{ lastCursor: string; lastLedger: number } | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- sorobanEventCursor model is pending Prisma migration; not yet in generated client
      const row = await (this.prisma as any).sorobanEventCursor.findUnique({
        where: { contractId: this.contractId },
        select: { lastCursor: true, lastLedger: true },
      });
      return row ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Determine which ledger to start from when no explicit ledger is provided:
   * - Use the persisted lastLedger if available
   * - Otherwise fall back to the current chain tip
   */
  private async loadStartLedger(): Promise<number> {
    const stored = await this.loadCursorRecord();
    if (stored && stored.lastLedger > 0) {
      logger.info(`[ContractEventIndexer] Resuming from persisted ledger ${stored.lastLedger}`);
      return stored.lastLedger;
    }

    const latestLedger = await this.server.ledgers().order('desc').limit(1).call();
    const seq: number = latestLedger.records[0].sequence;
    logger.info(`[ContractEventIndexer] No prior cursor; starting from current tip ledger ${seq}`);
    return seq;
  }

  /** Persist the latest cursor/ledger so polling can resume after a restart. */
  private async persistCursor(lastCursor: string, lastLedger: number): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- sorobanEventCursor model is pending Prisma migration; not yet in generated client
      await (this.prisma as any).sorobanEventCursor.upsert({
        where: { contractId: this.contractId },
        update: { lastCursor, lastLedger },
        create: { contractId: this.contractId, lastCursor, lastLedger },
      });
    } catch (err) {
      logger.error('[ContractEventIndexer] Failed to persist cursor:', err);
    }
  }

  private async notifyOnEvent(event: HorizonEventRecord): Promise<void> {
    if (!this.webPush) return;

    const eventType: string = event.type || event.eventType || '';
    const data = event.data ?? {};
    const members = extractMemberAddresses(event);

    if (isPayout(eventType)) {
      const amount = data.amount ?? data.value ?? '';
      const groupId = data.groupId ?? data.group_id ?? data.group ?? '';
      const payload = {
        title: 'Payout Received!',
        body: amount
          ? `You received a payout of ${amount}${groupId ? ` from group ${groupId}` : ''}.`
          : `Your savings group payout has been processed.`,
        data: { eventType, txHash: event.transactionHash ?? event.txHash, groupId, amount },
      };
      await this.webPush.sendToMembers(members, payload);
      logger.info(
        `Push notification sent for payout event (ledger ${event.ledger ?? event.ledgerSeq})`
      );
      return;
    }

    if (isMissedContribution(eventType)) {
      const amount = data.amount ?? data.value ?? '';
      const groupId = data.groupId ?? data.group_id ?? data.group ?? '';
      const payload = {
        title: 'Missed Contribution',
        body: amount
          ? `A contribution of ${amount} was missed${groupId ? ` in group ${groupId}` : ''}.`
          : `A contribution was missed in your savings group.`,
        data: { eventType, txHash: event.transactionHash ?? event.txHash, groupId, amount },
      };
      await this.webPush.sendToMembers(members, payload);
      logger.info(
        `Push notification sent for missed-contribution event (ledger ${event.ledger ?? event.ledgerSeq})`
      );
    }
  }

  async readinessCheckDatabase(): Promise<DependencyHealth> {
    const start = Date.now();
    try {
      // Lightweight connectivity test

      await this.prisma.$queryRaw`SELECT 1`;
      return { up: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        up: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async readinessCheckHorizon(): Promise<DependencyHealth> {
    const start = Date.now();
    try {
      // Use Horizon SDK as a reachability check (latest ledger is cheap enough)
      await withHorizonCircuit(() => this.server.ledgers().order('desc').limit(1).call());
      return { up: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        up: false,
        latencyMs: Date.now() - start,
        error: isCircuitOpenError(err)
          ? 'Horizon circuit breaker is OPEN'
          : err instanceof Error
            ? err.message
            : String(err),
      };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
