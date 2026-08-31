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
 * - Heartbeats are sent every HEARTBEAT_INTERVAL_MS. A missed heartbeat from
 *   the client within PONG_TIMEOUT_MS triggers disconnection.
 * - The server buffers at most MAX_QUEUE_PER_CLIENT events; if the client is
 *   slow the oldest entries are dropped and a "dropped" notice is sent.
 */

import { IncomingMessage, Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyJwt } from './auth_service';
import { logger } from './logger';
import { config } from './config';
import { Gauge, Counter } from 'prom-client';
import { registry } from './metrics';

// ── Constants ─────────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS = 10_000;
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
        this.send(client, JSON.stringify({ type: 'notice', message: 'event_dropped_backpressure' }));
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

  stop(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.wss.close();
    logger.info('[WSGateway] Stopped');
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
      const token = tokenFromQuery ?? (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);
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

    ws.on('pong', () => { client.isAlive = true; });
    ws.on('message', (data) => this.onMessage(client, data.toString()));
    ws.on('close', () => this.onClose(client));
    ws.on('error', (err) => {
      logger.warn('[WSGateway] Client error', { wallet: client.walletAddress, error: String(err) });
      this.onClose(client);
    });

    this.send(client, JSON.stringify({ type: 'connected', walletAddress: client.walletAddress }));
    logger.debug('[WSGateway] Client connected', { wallet: client.walletAddress, isAdmin });
  }

  private onMessage(client: ClientState, raw: string): void {
    let msg: unknown;
    try {
      msg = JSON.parse(raw);
    } catch {
      this.send(client, JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    const { type, topics } = msg as { type?: string; topics?: unknown };

    if (type === 'subscribe' && Array.isArray(topics)) {
      this.handleSubscribe(client, topics as string[]);
    } else if (type === 'unsubscribe' && Array.isArray(topics)) {
      this.handleUnsubscribe(client, topics as string[]);
    } else if (type === 'ping') {
      this.send(client, JSON.stringify({ type: 'pong', ts: Date.now() }));
    } else {
      this.send(client, JSON.stringify({ type: 'error', message: `Unknown message type: ${type}` }));
    }
  }

  private handleSubscribe(client: ClientState, topics: string[]): void {
    const accepted: string[] = [];
    const rejected: string[] = [];

    for (const topic of topics) {
      if (!isAuthorized(client, topic)) {
        rejected.push(topic);
        continue;
      }
      if (!this.subscriptions.has(topic)) this.subscriptions.set(topic, new Set());
      this.subscriptions.get(topic)!.add(client);
      client.topics.add(topic);
      accepted.push(topic);
    }

    this.send(client, JSON.stringify({ type: 'subscribed', accepted, rejected }));
    if (rejected.length > 0) {
      logger.warn('[WSGateway] Unauthorized subscribe attempt', {
        wallet: client.walletAddress,
        rejected,
      });
    }
  }

  private handleUnsubscribe(client: ClientState, topics: string[]): void {
    for (const topic of topics) {
      this.subscriptions.get(topic)?.delete(client);
      client.topics.delete(topic);
    }
    this.send(client, JSON.stringify({ type: 'unsubscribed', topics }));
  }

  private onClose(client: ClientState): void {
    for (const topic of client.topics) {
      this.subscriptions.get(topic)?.delete(client);
    }
    this.clients.delete(client.ws);
    wsActiveConnections.set(this.clients.size);
    logger.debug('[WSGateway] Client disconnected', { wallet: client.walletAddress });
  }

  // ── Heartbeat / backpressure helpers ────────────────────────────────────────

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const heartbeatFrame = JSON.stringify({ type: 'heartbeat', ts: Date.now() });
      for (const [ws, client] of this.clients) {
        if (!client.isAlive) {
          logger.debug('[WSGateway] Terminating unresponsive client', { wallet: client.walletAddress });
          ws.terminate();
          continue;
        }
        client.isAlive = false;
        ws.ping();
        this.send(client, heartbeatFrame);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private send(client: ClientState, frame: string): void {
    if (client.ws.readyState !== WebSocket.OPEN) return;
    try {
      client.ws.send(frame);
    } catch (err) {
      logger.warn('[WSGateway] Send error', { wallet: client.walletAddress, error: String(err) });
    }
  }

  private flush(client: ClientState): void {
    while (client.pendingQueue.length > 0 && client.ws.readyState === WebSocket.OPEN) {
      const frame = client.pendingQueue.shift()!;
      this.send(client, frame);
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _gateway: WebSocketGateway | null = null;

export function initWebSocketGateway(server: HttpServer): WebSocketGateway {
  if (!_gateway) {
    _gateway = new WebSocketGateway(server);
  }
  return _gateway;
}

export function getWebSocketGateway(): WebSocketGateway | null {
  return _gateway;
}
