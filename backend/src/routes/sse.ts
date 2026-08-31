/**
 * SSE (Server-Sent Events) route for real-time Soroban event streaming.
 * Issue #1011 — streams contract events to subscribed frontend clients.
 *
 * GET /api/v1/events/stream?groupId=<id>&types=ContributionMade,PayoutExecuted
 *
 * Clients receive JSON-encoded event payloads as SSE `data:` messages.
 * Falls back gracefully: if the client disconnects, no more messages are sent.
 */

import { Router, Request, Response } from 'express';
import type { ContractEventIndexer } from '../contract_event_indexer';

// In-memory registry of active SSE clients per group (or global)
// Maps groupId (or '*' for global) → Set of Response objects
const clients = new Map<string, Set<Response>>();

/** Register a new SSE client. Returns a cleanup function. */
function addClient(key: string, res: Response): () => void {
  if (!clients.has(key)) clients.set(key, new Set());
  clients.get(key)!.add(res);
  return () => {
    clients.get(key)?.delete(res);
    if (clients.get(key)?.size === 0) clients.delete(key);
  };
}

/**
 * Broadcast an event object to all clients subscribed to a group key.
 * Called by the ContractEventIndexer after it persists each new event.
 */
export function broadcastEvent(groupId: string | null, event: object): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`;

  // Broadcast to group-specific listeners
  if (groupId) {
    clients.get(groupId)?.forEach((res) => {
      try { res.write(payload); } catch { /* client gone */ }
    });
  }

  // Broadcast to global listeners
  clients.get('*')?.forEach((res) => {
    try { res.write(payload); } catch { /* client gone */ }
  });
}

export function createSseRouter(_eventIndexer: ContractEventIndexer): Router {
  const router = Router();

  /**
   * GET /api/v1/events/stream
   * Query params:
   *   groupId  – optional, scope to a single group
   *   types    – optional comma-separated event types to filter
   */
  router.get('/stream', (req: Request, res: Response) => {
    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
    res.flushHeaders();

    const groupId = (req.query['groupId'] as string | undefined) ?? null;
    const key = groupId ?? '*';

    // Send an initial "connected" heartbeat
    res.write(`event: connected\ndata: {"status":"ok"}\n\n`);

    // Keep-alive ping every 25 s (prevents proxies from closing idle connections)
    const keepAlive = setInterval(() => {
      try { res.write(': keepalive\n\n'); } catch { /* closed */ }
    }, 25_000);

    const cleanup = addClient(key, res);

    req.on('close', () => {
      clearInterval(keepAlive);
      cleanup();
    });
  });

  return router;
}
