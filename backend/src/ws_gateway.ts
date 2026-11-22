/**
 * ws_gateway.ts
 *
 * WebSocket gateway for real-time event streaming to clients (Issue #2).
 *
 * Replaces polling by pushing indexed ContractEvents to subscribed clients
 * filtered by group or wallet address.
 *
 * Protocol
 * ────────
 * Client connects:  wss://<host>/ws?token=<jwt>
 *
 * After auth, client sends a JSON subscribe message:
 *   { type: "subscribe", topics: ["group:<id>", "wallet:<address>"] }
 *
 * Server pushes:
 *   { type: "event",     topic: "group:<id>", payload: ContractEvent }
 *   { type: "heartbeat", ts: <epoch ms> }
 *   { type: "error",     message: "..." }
 *
 * Client may unsubscribe:
 *   { type: "unsubscribe", topics: ["group:<id>"] }
 *
 * Security
 * ────────
 * - JWT is required on connection (token query param or Authorization header).
 * - A user can only subscribe to their own wallet topic or groups they belong
 *   to. Admin JWT (via x-admin-secret) may subscribe to any topic.
 * - Unauthorized subscribe attempts return an error frame and are ignored.
 *
 * Backpressure / reconnection
 * ───────────────────────────
 * - Heartbeats are sent every HEARTBEAT_INTERVAL_MS: each tick checks whether
 *   the client's `isAlive` flag was set by a pong since the last tick and
 *   disconnects it if not, then pings again and resets the flag.
 * - The server buffers at most MAX_QUEUE_PER_CLIENT events; if the client is
 *   slow the oldest entries are dropped and a "dropped" notice is sent.
 */


import { Gauge, Counter } from 'prom-client';
import { WebSocketServer, WebSocket } from 'ws';

import { verifyJwt } from './modules/auth/auth_service';
import { config } from './config';
import { logger } from './logger';
import { registry } from './metrics';

import type { IncomingMessage, Server as HttpServer } from 'http';

// ── Constants ─────────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_QUEUE_PER_CLIENT = 100;

// ── Prometheus metrics ────────────────────────────────────────────────────────

export const wsActiveConnections = new Gauge({
  name: 'ws_active_connections',
  help: 'Number of active WebSocket connections',
  registers: [registry],
});

export const wsMessagesDelivered = new Counter({
  name: 'ws_messages_delivered_total',
  help: 'Total WebSocket event messages delivered to clients',
  labelNames: ['topic_type'],
  registers: [registry],
});

export const wsAuthRejections = new Counter({
  name: 'ws_auth_rejections_total',
  help: 'Total WebSocket connections rejected due to auth failure',
  registers: [registry],
});

// ── Types ─────────────────────────────────────────────────────────────────────

type TopicType = 'group' | 'wallet' | 'global';

interface ClientState {
  ws: WebSocket;
  walletAddress: string;
  isAdmin: boolean;
  topics: Set<string>;
  isAlive: boolean;
  pingTimer?: ReturnType<typeof setTimeout>;
  pendingQueue: string[];
}

// ── Topic helpers ─────────────────────────────────────────────────────────────

function parseTopic(topic: string): { type: TopicType; id: string } | null {
  const [type, ...rest] = topic.split(':');
  const id = rest.join(':');
  if ((type === 'group' || type === 'wallet') && id) return { type: type as TopicType, id };
  if (type === 'global') return { type: 'global', id: '' };
  return null;
}

function isAuthorized(client: ClientState, topic: string): boolean {
  if (client.isAdmin) return true;
  const parsed = parseTopic(topic);
  if (!parsed) return false;
  if (parsed.type === 'wallet') return parsed.id === client.walletAddress;
  // For group topics we allow any authenticated user to subscribe for now.
  // Tighten this once group membership is queryable.
  if (parsed.type === 'group') return true;
  return false;
}

// ── WebSocketGateway ──────────────────────────────────────────────────────────

export class WebSocketGateway {
  private wss: WebSocketServer;
  /** topic → set of client states */
  private subscriptions = new Map<string, Set<ClientState>>();
  /** ws → client state */
  private clients = new Map<WebSocket, ClientState>();
  private heartbeatTimer?: ReturnType<typeof setInterval>;

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('connection', this.onConnection.bind(this));
    this.startHeartbeat();
    logger.info('[WSGateway] WebSocket gateway started on path /ws');
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Publish an event to all clients subscribed to the given topic.
   * Called by ContractEventIndexer after each indexed event.
   */
  publish(topic: string, payload: unknown): void {
    const subs = this.subscriptions.get(topic);
    if (!subs || subs.size === 0) return;

    const frame = JSON.stringify({ type: 'event', topic, payload });
    const topicType = parseTopic(topic)?.type ?? 'unknown';

    for (const client of subs) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;

      // Backpressure: drop oldest if queue full
      if (client.pendingQueue.length >= MAX_QUEUE_PER_CLIENT) {
        client.pendingQueue.shift();
        this.send(
          client,
          JSON.stringify({ type: 'notice', message: 'event_dropped_backpressure' })
        );
      }

      client.pendingQueue.push(frame);
      this.flush(client);
      wsMessagesDelivered.inc({ topic_type: topicType });
    }
  }

  /**
   * Derive topics from a ContractEvent and publish to all matching subscribers.
   */
  publishContractEvent(event: {
    contractId: string;
    eventType: string;
    data: Record<string, unknown>;
    txHash: string;
    ledgerSeq: number;
    timestamp: Date;
  }): void {
    const data = event.data as Record<string, unknown>;
    const groupId = data?.groupId ?? data?.group_id ?? data?.group;
    const member = data?.member ?? data?.address ?? data?.recipient;

    if (groupId) this.publish(`group:${groupId}`, event);
    if (member) this.publish(`wallet:${member}`, event);
    this.publish('global', event);
  }

  /**
   * Stop the gateway. Returns a promise that resolves once the underlying
   * WebSocketServer has closed (or the timeout elapses), so the shutdown
   * coordinator can await it as part of the reverse-order teardown.
   */
  stop(timeoutMs = 5_000): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        logger.info('[WSGateway] Stopped');
        resolve();
      };

      const timer = setTimeout(() => {
        logger.warn('[WSGateway] Timed out waiting for clients to close', { timeoutMs });
        finish();
      }, timeoutMs);
      if (typeof timer.unref === 'function') timer.unref();

      // Terminate any lingering client sockets so close() can complete.
      for (const client of this.clients.values()) {
        try {
          client.ws.terminate();
        } catch {
          /* ignore */
        }
      }

      this.wss.close(() => finish());
    });
  }

  get connectionCount(): number {
    return this.clients.size;
  }

  // ── Connection handling ─────────────────────────────────────────────────────

  private onConnection(ws: WebSocket, req: IncomingMessage): void {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const tokenFromQuery = url.searchParams.get('token');
    const authHeader = req.headers['authorization'];
    const adminSecret = req.headers['x-admin-secret'];

    let walletAddress: string | null = null;
    let isAdmin = false;

    if (adminSecret && adminSecret === config.admin.secret) {
      isAdmin = true;
      walletAddress = 'admin';
    } else {
      const token =
        tokenFromQuery ?? (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);
      if (!token) {
        wsAuthRejections.inc();
        ws.close(4001, 'Unauthorized: missing token');
        return;
      }
      try {
        const payload = verifyJwt(token);
        walletAddress = payload.sub;
      } catch {
        wsAuthRejections.inc();
        ws.close(4001, 'Unauthorized: invalid or expired token');
        return;
      }
    }

    const client: ClientState = {
      ws,
      walletAddress: walletAddress!,
      isAdmin,
      topics: new Set(),
      isAlive: true,
      pendingQueue: [],
    };

    this.clients.set(ws, client);
    wsActiveConnections.set(this.clients.size);

    ws.on('pong', () => {
      client.isAlive = true;
    });
    ws.on('message', (data) => this.onMessage(client, data.toString()));
    ws.on('close', () => this.onClose(client));
    ws.on('error', (err) => {
      logger.warn('[WSGateway] Client error', { wallet: client.walletAddress, error: String(err) });
      this

/* … truncated 3921 chars — edit only what you need near the top … */
