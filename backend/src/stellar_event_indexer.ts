import { MongoClient, type Collection, type Db } from 'mongodb';
import type { ContractEvent } from './models';

export interface StellarIndexerOptions {
  horizonUrl?: string;
  mongodbUri?: string;
  dbName?: string;
  collectionName?: string;
  pollIntervalMs?: number;
  contractIds?: string[];
}

export interface EventQueryOptions {
  contractId?: string;
  type?: string;
  topic?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  sort?: 'asc' | 'desc';
}

export interface IndexerQueryResult {
  events: ContractEvent[];
  page: number;
  limit: number;
  total: number;
}

export class StellarEventIndexer {
  private client: MongoClient;
  private db?: Db;
  private collection?: Collection<ContractEvent>;
  private pollTimer: NodeJS.Timeout | null = null;
  private lastCursor: string = 'now';
  private connected = false;
  private ready = false;

  constructor(public readonly options: StellarIndexerOptions = {}) {
    const uri = options.mongodbUri ?? process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
    this.client = new MongoClient(uri);
  }

  async connect() {
    if (this.connected) return;
    await this.client.connect();
    this.db = this.client.db(this.options.dbName ?? process.env.MONGODB_DB ?? 'stellar-save');
    this.collection = this.db.collection<ContractEvent>(this.options.collectionName ?? 'contract_events');
    await this.ensureIndexes();
    this.connected = true;
    this.ready = true;
    await this.initializeCursor();
  }

  async ensureIndexes() {
    if (!this.collection) throw new Error('Indexer collection is not initialized');
    await this.collection.createIndex({ pagingToken: 1 }, { unique: true });
    await this.collection.createIndex({ contractId: 1 });
    await this.collection.createIndex({ type: 1 });
    await this.collection.createIndex({ topic: 1 });
    await this.collection.createIndex({ createdAt: 1 });
  }

  async initializeCursor() {
    if (!this.collection) return;
    const lastEvent = await this.collection.find().sort({ pagingToken: -1 }).limit(1).next();
    if (lastEvent?.pagingToken) {
      this.lastCursor = lastEvent.pagingToken;
    }
  }

  isReady() {
    return this.ready;
  }

  getLastCursor() {
    return this.lastCursor;
  }

  async start() {
    try {
      await this.connect();
      await this.indexNewEvents();
      const interval = this.options.pollIntervalMs ?? Number(process.env.INDEXER_POLL_INTERVAL_MS ?? 10000);
      this.pollTimer = setInterval(() => this.indexNewEvents().catch((err) => {
        console.error('Indexer poll failed:', err);
      }), interval);
    } catch (err) {
      console.error('StellarEventIndexer failed to start:', err);
      this.ready = false;
      throw err;
    }
  }

  async stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    await this.client.close();
    this.connected = false;
    this.ready = false;
  }

  private async fetchEvents(cursor: string) {
    const horizonUrl = this.options.horizonUrl ?? process.env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org';
    const url = new URL(`${horizonUrl.replace(/\/$/, '')}/events`);
    url.searchParams.set('limit', '200');
    url.searchParams.set('order', 'asc');
    url.searchParams.set('cursor', cursor || 'now');

    if (this.options.contractIds && this.options.contractIds.length > 0) {
      url.searchParams.set('contract_ids', this.options.contractIds.join(','));
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Horizon fetch failed: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    return Array.isArray(json._embedded?.records) ? json._embedded.records : [];
  }

  private toContractEvent(record: any): ContractEvent {
    return {
      id: record.id ?? `${record.paging_token}-${record.type}`,
      pagingToken: record.paging_token ?? record.pagingToken ?? '',
      type: record.type ?? 'unknown',
      typeI: typeof record.type_i === 'number' ? record.type_i : undefined,
      ledger: Number(record.ledger ?? 0),
      createdAt: new Date(record.created_at ?? record.createdAt ?? Date.now()),
      transactionHash: record.transaction_hash ?? record.transactionHash,
      sourceAccount: record.source_account ?? record.sourceAccount,
      contractId: record.contract_id ?? record.contractId ?? record.contract ?? undefined,
      topic: record.topic ?? record.event_type ?? undefined,
      data: record.data ?? record.value ?? record.body ?? null,
      raw: record,
    };
  }

  private buildFilter(options: EventQueryOptions) {
    const filter: any = {};
    if (options.contractId) filter.contractId = options.contractId;
    if (options.type) filter.type = options.type;
    if (options.topic) filter.topic = options.topic;
    if (options.from || options.to) {
      filter.createdAt = {};
      if (options.from) filter.createdAt.$gte = new Date(options.from);
      if (options.to) filter.createdAt.$lte = new Date(options.to);
    }
    return filter;
  }

  async queryEvents(options: EventQueryOptions = {}): Promise<IndexerQueryResult> {
    if (!this.collection) throw new Error('Indexer collection is not initialized');
    const limit = Math.min(200, Math.max(1, options.limit ?? 50));
    const page = Math.max(1, options.page ?? 1);
    const skip = (page - 1) * limit;
    const filter = this.buildFilter(options);
    const cursor = this.collection.find(filter).sort({ createdAt: -1, pagingToken: -1 }).skip(skip).limit(limit);
    const [events, total] = await Promise.all([
      cursor.toArray(),
      this.collection.countDocuments(filter),
    ]);
    return { events, page, limit, total };
  }

  async getEventById(id: string) {
    if (!this.collection) throw new Error('Indexer collection is not initialized');
    return this.collection.findOne({ id });
  }

  async indexNewEvents() {
    if (!this.collection) throw new Error('Indexer collection is not initialized');
    const records = await this.fetchEvents(this.lastCursor);
    if (records.length === 0) return { imported: 0, cursor: this.lastCursor };
    const events = records.map((record) => this.toContractEvent(record));
    const operations = events.map((event) => ({ updateOne: { filter: { pagingToken: event.pagingToken }, update: { $setOnInsert: event }, upsert: true } }));
    const result = await this.collection.bulkWrite(operations, { ordered: false });
    const lastEvent = events[events.length - 1];
    if (lastEvent.pagingToken) {
      this.lastCursor = lastEvent.pagingToken;
    }
    return {
      imported: result.upsertedCount ?? 0,
      matched: result.matchedCount ?? 0,
      cursor: this.lastCursor,
    };
  }
}
