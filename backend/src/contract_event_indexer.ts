import { Horizon } from '@stellar/stellar-sdk';
import { PrismaClient } from './generated/prisma/client';

export class ContractEventIndexer {
  private server: Horizon.Server;
  private prisma: PrismaClient;
  private contractId: string;
  private isRunning = false;

  constructor(horizonUrl: string, contractId: string, databaseUrl: string) {
    this.server = new Horizon.Server(horizonUrl);
    this.contractId = contractId;
    // Set the database URL in environment for Prisma
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
      // Get the latest ledger if not provided
      let startLedger = lastLedger;
      if (!startLedger) {
        const latestLedger = await this.server.ledgers().order('desc').limit(1).call();
        startLedger = latestLedger.records[0].sequence;
      }

      // Start streaming events
      this.streamEvents(startLedger!);
    } catch (error) {
      console.error('Error starting indexer:', error);
      this.isRunning = false;
    }
  }

  private async streamEvents(startLedger: number) {
    let cursor = startLedger.toString();

    while (this.isRunning) {
      try {
        // Use the Horizon REST API directly for events
        const url = new URL('/events', this.server.serverURL.toString());
        url.searchParams.set('contract', this.contractId);
        url.searchParams.set('cursor', cursor);
        url.searchParams.set('order', 'asc');
        url.searchParams.set('limit', '200');

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: any = await response.json();

        if (!data._embedded || data._embedded.records.length === 0) {
          // No new events, wait before checking again
          await this.delay(5000); // 5 seconds
          continue;
        }

        for (const event of data._embedded.records) {
          await this.storeEventFromHorizon(event);
        }

        // Update cursor to the last processed event
        cursor = data._embedded.records[data._embedded.records.length - 1].paging_token;

      } catch (error) {
        console.error('Error streaming events:', error);
        await this.delay(10000); // Wait 10 seconds on error
      }
    }
  }

  private async storeEventFromHorizon(event: any) {
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
      console.log(`Stored event: ${event.type} in ledger ${event.ledger}`);
    } catch (error) {
      console.error('Error storing event:', error);
    }
  }

  async stop() {
    this.isRunning = false;
    await this.prisma.$disconnect();
    console.log('Indexer stopped');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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