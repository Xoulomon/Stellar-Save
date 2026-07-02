/**
 * EventService.ts  (Issue #1011 — real-time streaming rewrite)
 *
 * Strategy:
 *   1. Connect via SSE to /api/v1/events/stream (backend event indexer).
 *   2. Debounce bursts: events arriving < DEBOUNCE_MS apart are coalesced
 *      into a single flush so the UI doesn't thrash on rapid-fire events.
 *   3. On connection loss, automatically fall back to 10-second RPC polling
 *      and attempt SSE reconnect with exponential back-off (max 60 s).
 *   4. Historical fetch (paginated) still goes directly to Soroban RPC.
 *
 * Singleton — import `eventService` at the bottom of this file.
 */

import { SorobanRpc, scValToNative, xdr } from '@stellar/stellar-sdk';
import { server, CONTRACT_ID } from './contractClient';
import type {
  AppEvent,
  EventType,
  GroupCreatedEvent,
  ContributionMadeEvent,
  PayoutExecutedEvent,
  GroupPausedEvent,
} from '../types/events';

export const PAGE_SIZE = 20;

// ─── Tunables ────────────────────────────────────────────────────────────────

const SSE_BASE_URL: string =
  (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? '/api/v1';
const DEBOUNCE_MS = 300;          // coalesce bursts within 300 ms
const POLL_INTERVAL_MS = 10_000;  // fallback polling interval
const SSE_RECONNECT_BASE_MS = 2_000;
const SSE_RECONNECT_MAX_MS = 60_000;

// ─── Raw event parsing (Soroban RPC → AppEvent) ───────────────────────────────

function parseRawEvent(raw: SorobanRpc.Api.RawEventResponse): AppEvent | null {
  try {
    if (raw.type !== 'contract') return null;

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
      case 'MemberJoined':
        return {
          type: 'MemberJoined' as EventType,
          groupId: BigInt(String(data['group_id'] ?? 0)),
          member: String(data['member'] ?? ''),
          memberCount: Number(data['member_count'] ?? 0),
          joinedAt: BigInt(String(data['joined_at'] ?? 0)),
        } as unknown as AppEvent;
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
      case 'GroupPaused': {
        const e: GroupPausedEvent = {
          type: 'GroupPaused',
          groupId: BigInt(String(data['group_id'] ?? 0)),
          pausedAt: BigInt(String(data['paused_at'] ?? 0)),
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

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventListener = (event: AppEvent) => void;

interface ListenerEntry {
  type: EventType | 'all';
  callback: EventListener;
}

export interface FetchEventsOptions {
  groupId?: bigint;
  types?: EventType[];
  cursor?: string;
  limit?: number;
}

export interface FetchEventsResult {
  events: AppEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ─── EventService ─────────────────────────────────────────────────────────────

export class EventService {
  private static instance: EventService;

  // Listener registry
  private listeners: ListenerEntry[] = [];

  // SSE state
  private sseSource: EventSource | null = null;
  private sseReconnectMs = SSE_RECONNECT_BASE_MS;
  private sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private sseConnected = false;

  // Polling fallback state
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private latestCursor: string | null = null;

  // Debounce buffer
  private debounceBuffer: AppEvent[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  isWatching = false;

  private constructor() {}

  static getInstance(): EventService {
    if (!EventService.instance) {
      EventService.instance = new EventService();
    }
    return EventService.instance;
  }

  // ── Subscription ────────────────────────────────────────────────────────────

  on(type: EventType | 'all', callback: EventListener): () => void {
    const entry: ListenerEntry = { type, callback };
    this.listeners.push(entry);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== entry);
    };
  }

  private scheduleFlush(event: AppEvent): void {
    this.debounceBuffer.push(event);
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.flushDebounce();
    }, DEBOUNCE_MS);
  }

  private flushDebounce(): void {
    const batch = this.debounceBuffer.splice(0);
    for (const evt of batch) {
      this.dispatchImmediate(evt);
    }
    this.debounceTimer = null;
  }

  private dispatchImmediate(event: AppEvent): void {
    for (const listener of this.listeners) {
      if (listener.type === 'all' || listener.type === event.type) {
        try { listener.callback(event); } catch { /* ignore handler errors */ }
      }
    }
  }

  // ── Historical fetch ──────────────────────────────────────────────────────

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

      if (groupId !== undefined) {
        parsed = parsed.filter((e) => {
          const ev = e as Record<string, unknown>;
          return ev['groupId'] === groupId;
        });
      }

      const lastEvent = rawEvents[rawEvents.length - 1];
      const nextCursor = lastEvent?.pagingToken ?? null;

      return { events: parsed, nextCursor, hasMore: rawEvents.length === limit };
    } catch {
      return { events: [], nextCursor: null, hasMore: false };
    }
  }

  // ── Real-time: SSE primary + polling fallback ────────────────────────────

  async startWatching(): Promise<void> {
    if (this.isWatching) return;
    this.isWatching = true;

    // Seed cursor for fallback polling
    try {
      const seed = await this.fetchEvents({ limit: 1 });
      this.latestCursor = seed.nextCursor;
    } catch { /* non-fatal */ }

    this.connectSSE();
  }

  stopWatching(): void {
    this.isWatching = false;
    this.disconnectSSE();
    this.stopPolling();
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.flushDebounce();
    }
  }

  // ── SSE connection ───────────────────────────────────────────────────────

  private connectSSE(): void {
    if (!this.isWatching) return;
    if (typeof EventSource === 'undefined') {
      // SSE not available (e.g. unit tests / old browsers) → use polling only
      this.startPolling();
      return;
    }

    try {
      const url = `${SSE_BASE_URL}/events/stream`;
      this.sseSource = new EventSource(url);

      this.sseSource.addEventListener('connected', () => {
        this.sseConnected = true;
        this.sseReconnectMs = SSE_RECONNECT_BASE_MS; // reset back-off
        this.stopPolling(); // SSE is up, stop polling fallback
      });

      this.sseSource.onmessage = (evt: MessageEvent<string>) => {
        try {
          const raw = JSON.parse(evt.data) as Record<string, unknown>;
          // Backend sends events in the same shape as AppEvent
          const event = raw as unknown as AppEvent;
          if (event.type) this.scheduleFlush(event);
        } catch { /* ignore malformed */ }
      };

      this.sseSource.onerror = () => {
        this.sseConnected = false;
        this.disconnectSSE();
        // Fall back to polling while we wait to reconnect
        if (!this.pollTimer) this.startPolling();
        this.scheduleSSEReconnect();
      };
    } catch {
      this.startPolling();
    }
  }

  private disconnectSSE(): void {
    if (this.sseSource) {
      this.sseSource.close();
      this.sseSource = null;
    }
    if (this.sseReconnectTimer !== null) {
      clearTimeout(this.sseReconnectTimer);
      this.sseReconnectTimer = null;
    }
    this.sseConnected = false;
  }

  private scheduleSSEReconnect(): void {
    if (!this.isWatching) return;
    if (this.sseReconnectTimer !== null) return;

    this.sseReconnectTimer = setTimeout(() => {
      this.sseReconnectTimer = null;
      // Exponential back-off with max cap
      this.sseReconnectMs = Math.min(this.sseReconnectMs * 2, SSE_RECONNECT_MAX_MS);
      this.connectSSE();
    }, this.sseReconnectMs);
  }

  // ── Polling fallback ─────────────────────────────────────────────────────

  private startPolling(): void {
    if (this.pollTimer !== null) return;
    this.pollTimer = setInterval(() => { void this.poll(); }, POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async poll(): Promise<void> {
    // If SSE reconnected, stop polling
    if (this.sseConnected) {
      this.stopPolling();
      return;
    }
    try {
      const result = await this.fetchEvents({
        cursor: this.latestCursor ?? undefined,
        limit: 50,
      });

      for (const event of result.events) {
        this.scheduleFlush(event);
      }
      if (result.nextCursor) this.latestCursor = result.nextCursor;
    } catch { /* swallow, retry next interval */ }
  }
}

// Singleton export
export const eventService = EventService.getInstance();
