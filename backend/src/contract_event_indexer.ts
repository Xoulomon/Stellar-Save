import { Horizon } from '@stellar/stellar-sdk';
import { PrismaClient } from './generated/prisma/client';
import { GroupStateCache } from './lib/cache';

const POLL_INTERVAL_MS = 5_000;
const ERROR_BACKOFF_MS = 10_000;
const PAGE_LIMIT = 200;

export class ContractEventIndexer {
  private server: Horizon.Server;
  private prisma: PrismaClient;
  private contractId: string;
  private isRunning = false;

  constructor(horizonUrl: string, contractId: string, databaseUrl: string) {
    this.server = new Horizon.Server(horizonUrl);
    this.contractId = contractId;
    process.env.DATABASE_URL = databaseUrl;
    this.prisma = new (PrismaClient as any)();
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
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} from ${url}`);
        }

        const data: any = await response.json();
        const records: any[] = data._embedded?.records ?? [];

        if (records.length === 0) {
          await this.delay(POLL_INTERVAL_MS);
          continue;
        }

        for (const event of records) {
          await this.storeEvent(event);
        }

        // Advance cursor to the paging token of the last processed record
        cursor = records[records.length - 1].paging_token;
        const lastLedger: number = records[records.length - 1].ledger ?? 0;
        await this.persistCursor(cursor, lastLedger);

        // Invalidate cached group state for the affected contract so the next
      // read fetches fresh data from Soroban RPC.
      await GroupStateCache.invalidateContract(this.contractId);

      console.log(
          `[ContractEventIndexer] Indexed ${records.length} event(s); cursor=${cursor} ledger=${lastLedger}`
        );
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
      await this.prisma.contractEvent.create({
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
      console.log(`[ContractEventIndexer] Stored event: ${event.type} in ledger ${event.ledger}`);
    } catch (error) {
      console.error('[ContractEventIndexer] Error storing event:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
