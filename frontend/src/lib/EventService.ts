/**
 * EventService.ts
 *
 * Fetches historical Soroban contract events via the RPC `getEvents` API
 * and provides a real-time polling mechanism for new events.
 *
 * Design:
 * - Cursor-based pagination: each page returns a `cursor` for the next fetch.
 * - Polling interval: configurable, defaults to 10 s.
 * - Singleton pattern so multiple hooks share one connection.
 * - Typed event parsing: raw XDR → strongly-typed AppEvent.
 */

import { SorobanRpc, scValToNative, xdr } from '@stellar/stellar-sdk';
import { server, CONTRACT_ID } from './contractClient';
import type {
  AppEvent,
  EventType,
  GroupCreatedEvent,
  ContributionMadeEvent,
  PayoutExecutedEvent,
} from '../types/events';

export const PAGE_SIZE = 20;
const POLL_INTERVAL_MS = 10_000;

// ─── Raw event parsing ────────────────────────────────────────────────────────

function parseRawEvent(raw: SorobanRpc.Api.RawEventResponse): AppEvent | null {
  try {
    if (raw.type !== 'contract') return null;

    // The first topic is the event name as a Symbol
    const topics = raw.topic.map((t) =>
      scValToNative(xdr.ScVal.fromXDR(t, 'base64')),
    );
    const eventName = topics[0] as string | undefined;
    if (!eventName) return null;

    const body = raw.value
      ? scValToNative(xdr.ScVal.fromXDR(raw.value, 'base64'))
      : {};

    const data = body as Record<string, unknown>;

    switch (eventName) {
      case 'GroupCreated': {
        const e: GroupCreatedEvent = {
          type: 'GroupCreated',
          groupId: BigInt(String(data['group_id'] ?? 0)),
          creator: String(data['creator'] ?? ''),
          contributionAmount: BigInt(String(data['contribution_amount'] ?? 0)),
          cycleDuration: BigInt(String(data['cycle_duration'] ?? 0)),
          maxMembers: Number(data['max_members'] ?? 0),
          createdAt: BigInt(String(data['created_at'] ?? 0)),
        };
        return e;
      }
      case 'MemberJoined': {
        // Map to a synthetic ContributionMadeEvent-like shape isn't ideal;
        // instead we extend AppEvent in types/events.ts. For now we surface
        // it as a dedicated type via the union.
        // We cast to unknown first to satisfy the union until types are extended.
        return {
          type: 'MemberJoined' as EventType,
          groupId: BigInt(String(data['group_id'] ?? 0)),
          member: String(data['member'] ?? ''),
          memberCount: Number(data['member_count'] ?? 0),
          joinedAt: BigInt(String(data['joined_at'] ?? 0)),
        } as unknown as AppEvent;
      }
      case 'ContributionMade': {
        const e: ContributionMadeEvent = {
          type: 'ContributionMade',
          groupId: BigInt(String(data['group_id'] ?? 0)),
          contributor: String(data['contributor'] ?? ''),
          amount: BigInt(String(data['amount'] ?? 0)),
          cycle: Number(data['cycle'] ?? 0),
          cycleTotal: BigInt(String(data['cycle_total'] ?? 0)),
          contributedAt: BigInt(String(data['contributed_at'] ?? 0)),
        };
        return e;
      }
      case 'PayoutExecuted': {
        const e: PayoutExecutedEvent = {
          type: 'PayoutExecuted',
          groupId: BigInt(String(data['group_id'] ?? 0)),
          recipient: String(data['recipient'] ?? ''),
          amount: BigInt(String(data['amount'] ?? 0)),
          cycle: Number(data['cycle'] ?? 0),
          executedAt: BigInt(String(data['executed_at'] ?? 0)),
        };
        return e;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// ─── EventService ─────────────────────────────────────────────────────────────

export type EventListener = (event: AppEvent) => void;

interface ListenerEntry {
  type: EventType | 'all';
  callback: EventListener;
}

export interface FetchEventsOptions {
  groupId?: bigint;
  types?: EventType[];
  /** Opaque cursor returned by a previous fetch; pass to get the next page */
  cursor?: string;
  limit?: number;
}

export interface FetchEventsResult {
  events: AppEvent[];
  /** Pass this as `cursor` in the next call to get older events */
  nextCursor: string | null;
  hasMore: boolean;
}

export class EventService {
  private static instance: EventService;

  private listeners: ListenerEntry[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private latestCursor: string | null = null;
  isWatching = false;

  private constructor() {}

  static getInstance(): EventService {
    if (!EventService.instance) {
      EventService.instance = new EventService();
    }
    return EventService.instance;
  }

  // ── Subscription ────────────────────────────────────────────────────────────

  /** Subscribe to live events. Returns an unsubscribe function. */
  on(type: EventType | 'all', callback: EventListener): () => void {
    const entry: ListenerEntry = { type, callback };
    this.listeners.push(entry);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== entry);
    };
  }

  private emit(event: AppEvent): void {
    for (const listener of this.listeners) {
      if (listener.type === 'all' || listener.type === event.type) {
        listener.callback(event);
      }
    }
  }

  // ── Historical fetch (paginated) ─────────────────────────────────────────────

  /**
   * Fetches a page of historical events from the Soroban RPC.
   * Pass `cursor` from a previous result to load older events (infinite scroll).
   */
  async fetchEvents(options: FetchEventsOptions = {}): Promise<FetchEventsResult> {
    const { groupId, types, cursor, limit = PAGE_SIZE } = options;

    if (!CONTRACT_ID) {
      return { events: [], nextCursor: null, hasMore: false };
    }

    try {
      const filters: SorobanRpc.Server.GetEventsRequest['filters'] = [
        {
          type: 'contract',
          contractIds: [CONTRACT_ID],
          ...(types && types.length > 0
            ? { topics: [types.map((t) => `sym:${t}`)] }
            : {}),
        },
      ];

      const request: SorobanRpc.Server.GetEventsRequest = {
        filters,
        limit,
        ...(cursor ? { cursor } : { startLedger: 1 }),
      };

      const response = await server.getEvents(request);
      const rawEvents = response.events ?? [];

      let parsed = rawEvents
        .map(parseRawEvent)
        .filter((e): e is AppEvent => e !== null);

      // Client-side group filter (RPC topic filter handles type filter)
      if (groupId !== undefined) {
        parsed = parsed.filter((e) => {
          const ev = e as Record<string, unknown>;
          return ev['groupId'] === groupId;
        });
      }

      const lastEvent = rawEvents[rawEvents.length - 1];
      const nextCursor = lastEvent?.pagingToken ?? null;

      return {
        events: parsed,
        nextCursor,
        hasMore: rawEvents.length === limit,
      };
    } catch {
      return { events: [], nextCursor: null, hasMore: false };
    }
  }

  // ── Real-time polling ────────────────────────────────────────────────────────

  async startWatching(): Promise<void> {
    if (this.isWatching) return;
    this.isWatching = true;

    // Seed the cursor to "now" so we only get new events going forward
    try {
      const seed = await this.fetchEvents({ limit: 1 });
      this.latestCursor = seed.nextCursor;
    } catch {
      // Non-fatal: we'll poll from the beginning
    }

    this.pollTimer = setInterval(() => {
      void this.poll();
    }, POLL_INTERVAL_MS);
  }

  stopWatching(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isWatching = false;
  }

  private async poll(): Promise<void> {
    try {
      const result = await this.fetchEvents({
        cursor: this.latestCursor ?? undefined,
        limit: 50,
      });

      if (result.events.length > 0) {
        for (const event of result.events) {
          this.emit(event);
        }
        if (result.nextCursor) {
          this.latestCursor = result.nextCursor;
        }
      }
    } catch {
      // Swallow poll errors — will retry next interval
    }
  }
}

// Convenience singleton export
export const eventService = EventService.getInstance();
