import { Horizon } from '@stellar/stellar-sdk';
import { PrismaClient } from './generated/prisma/client';
import { WebPushService } from './web_push_service';
import { eventsIndexedTotal, sorobanRpcCallsTotal } from './metrics';

// Event types emitted by the Stellar savings contract
const PAYOUT_EVENT_TYPES = ['payout', 'payout_received', 'payoutreceived', 'payout_processed'];
const MISSED_CONTRIBUTION_TYPES = ['missed_contribution', 'missedcontribution', 'contribution_missed', 'missed'];

function isPayout(eventType: string): boolean {
  return PAYOUT_EVENT_TYPES.includes(eventType.toLowerCase().replace(/-/g, '_'));
}

function isMissedContribution(eventType: string): boolean {
  return MISSED_CONTRIBUTION_TYPES.includes(eventType.toLowerCase().replace(/-/g, '_'));
}

// Extract member addresses from Stellar contract event topics/data
function extractMemberAddresses(event: any): string[] {
  const addresses: string[] = [];

  const topicsArr: unknown[] = Array.isArray(event.topic) ? event.topic : [];
  for (const t of topicsArr) {
    if (typeof t === 'string' && t.startsWith('G')) addresses.push(t);
    else if (typeof t === 'object' && t !== null && 'address' in t) addresses.push((t as any).address);
  }

  const data = event.data ?? {};
  for (const key of ['member', 'recipient', 'address', 'sender']) {
    if (typeof data[key] === 'string') addresses.push(data[key]);
  }

  return [...new Set(addresses)];
}

export class ContractEventIndexer {
  private server: Horizon.Server;
  private prisma: PrismaClient;
  private contractId: string;
  private isRunning = false;
  private webPush?: WebPushService;

  constructor(horizonUrl: string, contractId: string, databaseUrl: string, webPush?: WebPushService) {
    this.server = new Horizon.Server(horizonUrl);
    this.contractId = contractId;
    process.env.DATABASE_URL = databaseUrl;
    this.prisma = new (PrismaClient as any)();
    this.webPush = webPush;
  }

  async start(lastLedger?: number) {
    if (this.isRunning) {
      console.log('Indexer is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting contract event indexer...');

    try {
      const startLedger = lastLedger ?? await this.loadStartLedger();
      this.streamEvents(startLedger).catch(err => {
        console.error('Fatal error in stream loop:', err);
        this.isRunning = false;
      });
    } catch (error) {
      console.error('Error starting indexer:', error);
      this.isRunning = false;
    }
  }

  async stop() {
    this.isRunning = false;
    await this.prisma.$disconnect();
    console.log('Indexer stopped');
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
    const where: any = {};

    if (options.contractId) where.contractId = options.contractId;
    if (options.eventType) where.eventType = options.eventType;
    if (options.startLedger || options.endLedger) {
      where.ledgerSeq = {};
      if (options.startLedger) where.ledgerSeq.gte = options.startLedger;
      if (options.endLedger) where.ledgerSeq.lte = options.endLedger;
    }
    if (options.startTime || options.endTime) {
      where.timestamp = {};
      if (options.startTime) where.timestamp.gte = options.startTime;
      if (options.endTime) where.timestamp.lte = options.endTime;
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

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async streamEvents(startLedger: number): Promise<void> {
    const stored = await this.loadCursorRecord();
    // Use the persisted paging token if available; otherwise fall back to the
    // startLedger sequence number (Horizon accepts ledger seq as a cursor).
    let cursor: string = stored?.lastCursor || String(startLedger);

    console.log(`[ContractEventIndexer] Starting from cursor=${cursor}`);

    while (this.isRunning) {
      try {
        const url = new URL('/events', this.server.serverURL.toString());
        url.searchParams.set('contract', this.contractId);
        url.searchParams.set('startLedger', cursor);
        url.searchParams.set('order', 'asc');
        url.searchParams.set('limit', String(PAGE_LIMIT));

        const response = await fetch(url.toString());
        sorobanRpcCallsTotal.inc({ method: 'getEvents', status: response.ok ? 'success' : 'error' });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} from ${url}`);
        }

        const data: any = await response.json();
        const records: any[] = data._embedded?.records ?? [];

        if (records.length === 0) {
          await this.delay(POLL_INTERVAL_MS);
          continue;
        }

        for (const event of data._embedded.records) {
          await this.storeEventFromHorizon(event);
          await this.notifyOnEvent(event);
        }

        // Update cursor to the last processed event
        cursor = data._embedded.records[data._embedded.records.length - 1].paging_token;
      } catch (error) {
        console.error('[ContractEventIndexer] Poll error:', error);
        await this.delay(ERROR_BACKOFF_MS);
      }
    }
  }

  /** Load the persisted cursor for this contract, returning null if none stored. */
  private async loadCursorRecord(): Promise<{ lastCursor: string; lastLedger: number } | null> {
    try {
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
      console.log(`[ContractEventIndexer] Resuming from persisted ledger ${stored.lastLedger}`);
      return stored.lastLedger;
    }

    const latestLedger = await this.server.ledgers().order('desc').limit(1).call();
    const seq: number = latestLedger.records[0].sequence;
    console.log(`[ContractEventIndexer] No prior cursor; starting from current tip ledger ${seq}`);
    return seq;
  }

  /** Persist the latest cursor/ledger so polling can resume after a restart. */
  private async persistCursor(lastCursor: string, lastLedger: number): Promise<void> {
    try {
      await (this.prisma as any).sorobanEventCursor.upsert({
        where: { contractId: this.contractId },
        update: { lastCursor, lastLedger },
        create: { contractId: this.contractId, lastCursor, lastLedger },
      });
    } catch (err) {
      console.error('[ContractEventIndexer] Failed to persist cursor:', err);
    }
  }

  private async storeEvent(event: any): Promise<void> {
    try {
      const stored = await this.prisma.contractEvent.create({
        data: {
          contractId: event.contractId || this.contractId,
          eventType: event.type || 'unknown',
          topics: event.topic || [],
          data: event.data || {},
          txHash: event.transactionHash || event.txHash,
          ledgerSeq: event.ledger || event.ledgerSeq,
          timestamp: event.createdAt ? new Date(event.createdAt) : new Date(),
          blockTime: event.createdAt ? new Date(event.createdAt) : new Date(),
        },
      });
      console.log(`Stored event: ${event.type} in ledger ${event.ledger}`);
      eventsIndexedTotal.inc({ event_type: event.type || 'unknown' });

      // Deliver signed webhook notifications for group events
      const webhookEvent = this.mapToWebhookEvent(stored.eventType);
      if (webhookEvent) {
        const groupId = this.extractGroupId(stored.data);
        deliverWebhookEvent(webhookEvent, {
          contractId: stored.contractId,
          txHash: stored.txHash,
          ledgerSeq: stored.ledgerSeq,
          timestamp: stored.timestamp.toISOString(),
          data: stored.data,
        }, groupId).catch(() => {/* non-blocking */});
      }

      // Update member reputation for contribution events
      if (webhookEvent === 'contribution.created') {
        const data = stored.data as any;
        const memberAddress = data?.member || data?.address;
        if (memberAddress) {
          // Treat all indexed contributions as on-time (late detection requires cycle data)
          recordContribution(String(memberAddress), true).catch(() => {/* non-blocking */});
        }
      }
    } catch (error) {
      console.error('[ContractEventIndexer] Error storing event:', error);
    }
  }

  private async notifyOnEvent(event: any): Promise<void> {
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
      console.log(`Push notification sent for payout event (ledger ${event.ledger ?? event.ledgerSeq})`);
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
      console.log(`Push notification sent for missed-contribution event (ledger ${event.ledger ?? event.ledgerSeq})`);
    }
  }

  async stop() {
    this.isRunning = false;
    await this.prisma.$disconnect();
    console.log('Indexer stopped');
  }

  async readinessCheckDatabase(): Promise<DependencyHealth> {
    const start = Date.now();
    try {
      // Lightweight connectivity test
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
      await this.server.ledgers().order('desc').limit(1).call();
      return { up: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        up: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Method to get events with pagination and filtering
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
    const where: any = {};

    if (options.contractId) where.contractId = options.contractId;
    if (options.eventType) where.eventType = options.eventType;
    if (options.startLedger || options.endLedger) {
      where.ledgerSeq = {};
      if (options.startLedger) where.ledgerSeq.gte = options.startLedger;
      if (options.endLedger) where.ledgerSeq.lte = options.endLedger;
    }
    if (options.startTime || options.endTime) {
      where.timestamp = {};
      if (options.startTime) where.timestamp.gte = options.startTime;
      if (options.endTime) where.timestamp.lte = options.endTime;
    }

    const events = await this.prisma.contractEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0,
    });

    const total = await this.prisma.contractEvent.count({ where });

    return {
      events,
      total,
      limit: options.limit || 50,
      offset: options.offset || 0,
    };
  }
}
