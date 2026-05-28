import { PrismaClient } from '../generated/prisma/client';

export interface IndexerOptions {
  /** How long to wait between polls when no new transactions are found (ms). Default: 5000 */
  pollIntervalMs?: number;
  /** Page size for each Horizon request. Default: 200 */
  pageSize?: number;
}

export interface TransactionPage {
  transactions: {
    id: string;
    txHash: string;
    ledgerSeq: number;
    sourceAccount: string;
    feePaid: number;
    operationCount: number;
    envelopeXdr: string | null;
    resultXdr: string | null;
    pagingToken: string;
    createdAt: Date;
    indexedAt: Date;
  }[];
  total: number;
  limit: number;
  offset: number;
}

export class HorizonIndexer {
  private prisma: PrismaClient;
  private horizonUrl: string;
  private contractId: string;
  private pollIntervalMs: number;
  private pageSize: number;
  private isRunning = false;

  constructor(horizonUrl: string, contractId: string, options: IndexerOptions = {}) {
    this.horizonUrl = horizonUrl.replace(/\/$/, '');
    this.contractId = contractId;
    this.pollIntervalMs = options.pollIntervalMs ?? 5000;
    this.pageSize = options.pageSize ?? 200;
    this.prisma = new (PrismaClient as any)();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[HorizonIndexer] Already running');
      return;
    }
    this.isRunning = true;
    console.log('[HorizonIndexer] Starting — contract:', this.contractId);
    // Run poll loop detached so callers are not blocked
    this.runPollLoop().catch(err => {
      console.error('[HorizonIndexer] Fatal error in poll loop:', err);
      this.isRunning = false;
    });
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.prisma.$disconnect();
    console.log('[HorizonIndexer] Stopped');
  }

  /** Returns the highest ledger sequence seen in the indexed transactions table. */
  async getLastIndexedLedger(): Promise<number> {
    const row = await this.prisma.indexedTransaction.findFirst({
      orderBy: { ledgerSeq: 'desc' },
      select: { ledgerSeq: true },
    });
    return row?.ledgerSeq ?? 0;
  }

  /** Query stored transactions with optional filters. */
  async getTransactions(options: {
    limit?: number;
    offset?: number;
    sourceAccount?: string;
    minLedger?: number;
    maxLedger?: number;
  } = {}): Promise<TransactionPage> {
    const where: Record<string, unknown> = {};

    if (options.sourceAccount) where.sourceAccount = options.sourceAccount;
    if (options.minLedger !== undefined || options.maxLedger !== undefined) {
      const ledgerFilter: Record<string, number> = {};
      if (options.minLedger !== undefined) ledgerFilter.gte = options.minLedger;
      if (options.maxLedger !== undefined) ledgerFilter.lte = options.maxLedger;
      where.ledgerSeq = ledgerFilter;
    }

    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const [transactions, total] = await Promise.all([
      this.prisma.indexedTransaction.findMany({
        where,
        orderBy: { ledgerSeq: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.indexedTransaction.count({ where }),
    ]);

    return { transactions, total, limit, offset };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async runPollLoop(): Promise<void> {
    let cursor = await this.resumeCursor();

    while (this.isRunning) {
      try {
        const url = new URL(
          `/accounts/${encodeURIComponent(this.contractId)}/transactions`,
          this.horizonUrl
        );
        url.searchParams.set('cursor', cursor);
        url.searchParams.set('order', 'asc');
        url.searchParams.set('limit', String(this.pageSize));

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`Horizon responded ${res.status} for ${url}`);

        const body: any = await res.json();
        const records: any[] = body._embedded?.records ?? [];

        if (records.length === 0) {
          await this.delay(this.pollIntervalMs);
          continue;
        }

        for (const tx of records) {
          await this.storeTx(tx);
        }

        // Advance cursor to the paging_token of the last record processed
        cursor = records[records.length - 1].paging_token;
        console.log(
          `[HorizonIndexer] Indexed ${records.length} tx(s), cursor now ${cursor}`
        );
      } catch (err) {
        console.error('[HorizonIndexer] Poll error:', err);
        await this.delay(this.pollIntervalMs * 2);
      }
    }
  }

  /** Pick up where we left off: use the paging_token of the last stored tx, or 'now'. */
  private async resumeCursor(): Promise<string> {
    const latest = await this.prisma.indexedTransaction.findFirst({
      orderBy: { ledgerSeq: 'desc' },
      select: { pagingToken: true, ledgerSeq: true },
    });

    if (latest) {
      console.log(`[HorizonIndexer] Resuming from ledger ${latest.ledgerSeq}`);
      return latest.pagingToken;
    }

    // No prior state — start from the current tip of the chain
    console.log('[HorizonIndexer] No prior state; starting from current ledger tip');
    return 'now';
  }

  /** Upsert one transaction; the unique constraint on txHash provides deduplication. */
  private async storeTx(tx: any): Promise<void> {
    try {
      await this.prisma.indexedTransaction.upsert({
        where: { txHash: tx.hash },
        // On conflict: do nothing — duplicate is already stored
        update: {},
        create: {
          txHash: tx.hash,
          ledgerSeq: Number(tx.ledger),
          sourceAccount: tx.source_account ?? '',
          feePaid: tx.fee_charged ? parseInt(tx.fee_charged, 10) : 0,
          operationCount: tx.operation_count ?? 0,
          envelopeXdr: tx.envelope_xdr ?? null,
          resultXdr: tx.result_xdr ?? null,
          pagingToken: tx.paging_token,
          createdAt: tx.created_at ? new Date(tx.created_at) : new Date(),
        },
      });
    } catch (err: any) {
      // Unique-constraint violations from concurrent indexers are harmless
      if (!String(err).includes('Unique constraint')) {
        console.error('[HorizonIndexer] Failed to store tx', tx.hash, err);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
