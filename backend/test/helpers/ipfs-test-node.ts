/**
 * In-process IPFS HTTP RPC test double.
 *
 * Implements the subset of the IPFS HTTP API used by backend/src/ipfs/client.ts:
 *   - /api/v0/add      -> upload content, returns { Name, Hash, Size }
 *   - /api/v0/cat      -> retrieve content by CID
 *   - /api/v0/pin/add  -> pin a CID
 *   - /api/v0/pin/rm   -> unpin a CID
 *   - /api/v0/pin/ls   -> list pins
 *   - /api/v0/id       -> node identity (used by health checks)
 *
 * Content is stored in memory with deterministic content-based CIDs so tests
 * can assert stable identifiers and round-trip uploads/retrievals without
 * standing up a real IPFS daemon.
 */

import http, { IncomingMessage, ServerResponse } from 'http';
import type { AddressInfo } from 'net';

export interface IpfsTestContent {
  data: Buffer;
  name: string;
}

type PinType = 'direct' | 'recursive' | 'indirect';

type FailRule = 'all' | 'add' | 'cat' | 'pin' | 'pin_add' | 'pin_rm' | 'pin_ls' | 'id';

interface IpfsTestNodeOptions {
  /**
   * When true, every request fails with a 500 to exercise failure paths.
   * Individual rules can be toggled at runtime via `failNext()`/`setErrorMode()`.
   */
  failRequests?: boolean;
  /**
   * Endpoints that should fail regardless of the global error mode. Keeping
   * /id healthy while failing pin_add lets tests exercise the queue retry path
   * (processQueue health-checks via /id before pinning).
   */
  failEndpoints?: FailRule[];
}

interface PinRecord {
  cid: string;
  type: PinType;
}

/**
 * A deterministic content-addressable identifier used in place of a real
 * multihash CID within the test double.
 */
export function contentId(data: Buffer): string {
  return `QmTest${hashBuffer(data)}`;
}

function hashBuffer(buf: Buffer): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < buf.length; i++) {
    hash ^= buf[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export class IpfsTestNode {
  private server: http.Server;
  private blocks = new Map<string, IpfsTestContent>();
  private pins = new Map<string, PinRecord>();
  private errorMode = false;
  private failNextCount = 0;
  private failEndpoints = new Set<FailRule>();

  constructor(options: IpfsTestNodeOptions = {}) {
    this.errorMode = options.failRequests ?? false;
    if (options.failEndpoints) {
      for (const ep of options.failEndpoints) this.failEndpoints.add(ep);
    }
    this.server = http.createServer(this.handle.bind(this));
  }

  start(): Promise<number> {
    return new Promise((resolve) => {
      this.server.listen(0, '127.0.0.1', () => {
        const { port } = this.server.address() as AddressInfo;
        resolve(port);
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err?: Error) => (err ? reject(err) : resolve()));
    });
  }

  get baseUrl(): string {
    const { port } = this.server.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  /** Fail the next N requests regardless of the current error mode. */
  failNext(count = 1): void {
    this.failNextCount = count;
  }

  /** Globally toggle whether requests fail. */
  setErrorMode(enabled: boolean): void {
    this.errorMode = enabled;
  }

  /** Fail a specific endpoint (e.g. 'pin_add') regardless of global error mode. */
  failEndpoint(rule: FailRule): void {
    this.failEndpoints.add(rule);
  }

  /** Stop failing a specific endpoint. */
  healEndpoint(rule: FailRule): void {
    this.failEndpoints.delete(rule);
  }

  /** Clear all endpoint failure rules. */
  healAllEndpoints(): void {
    this.failEndpoints.clear();
  }

  hasBlock(cid: string): boolean {
    return this.blocks.has(cid);
  }

  getPins(): PinRecord[] {
    return Array.from(this.pins.values());
  }

  private ruleForPath(path: string): FailRule {
    switch (path) {
      case '/api/v0/add':
        return 'add';
      case '/api/v0/cat':
        return 'cat';
      case '/api/v0/pin/add':
        return 'pin_add';
      case '/api/v0/pin/rm':
        return 'pin_rm';
      case '/api/v0/pin/ls':
        return 'pin_ls';
      case '/api/v0/id':
        return 'id';
      default:
        return 'pin';
    }
  }

  private shouldFailPath(path: string): boolean {
    if (this.failNextCount > 0) {
      this.failNextCount--;
      return true;
    }
    if (this.errorMode) return true;
    return this.failEndpoints.has(this.ruleForPath(path));
  }

  private handle(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', this.baseUrl);
    const path = url.pathname;

    if (this.shouldFailPath(path)) {
      sendJson(res, 500, { Message: 'IPFS test node error', Code: 0, Type: 'error' });
      return;
    }

    try {
      switch (path) {
        case '/api/v0/add':
          this.handleAdd(req, res);
          break;
        case '/api/v0/cat':
          this.handleCat(url, res);
          break;
        case '/api/v0/pin/add':
          this.handlePinAdd(url, res);
          break;
        case '/api/v0/pin/rm':
          this.handlePinRm(url, res);
          break;
        case '/api/v0/pin/ls':
          this.handlePinLs(url, res);
          break;
        case '/api/v0/id':
          sendJson(res, 200, {
            ID: 'QmTestNodeId123',
            PublicKey: 'CAESQL7_test',
            Addresses: ['/ip4/127.0.0.1/tcp/4001'],
            AgentVersion: 'kubo/test',
            ProtocolVersion: 'ipfs/0.1.0',
            Protocols: ['/ipfs/kad/1.0.0'],
          });
          break;
        default:
          sendJson(res, 404, { Message: 'not found', Code: 0, Type: 'error' });
      }
    } catch (err) {
      sendJson(res, 500, {
        Message: err instanceof Error ? err.message : String(err),
        Code: 0,
        Type: 'error',
      });
    }
  }

  private async handleAdd(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const raw = await readBody(req);
    const name = extractFileName(raw) ?? 'metadata.json';
    const data = stripMultipartData(raw);

    const cid = contentId(data);
    this.blocks.set(cid, { data, name });

    // IPFS auto-pins freshly added content as a direct pin.
    if (!this.pins.has(cid)) {
      this.pins.set(cid, { cid, type: 'direct' });
    }

    sendJson(res, 200, { Name: name, Hash: cid, Size: String(data.length) });
  }

  private handleCat(url: URL, res: ServerResponse): void {
    const cid = url.searchParams.get('arg') ?? '';
    const entry = this.blocks.get(cid);
    if (!entry) {
      sendJson(res, 500, { Message: 'block not found', Code: 0, Type: 'error' });
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    res.end(entry.data);
  }

  private handlePinAdd(url: URL, res: ServerResponse): void {
    const cid = url.searchParams.get('arg') ?? '';
    const type = (url.searchParams.get('recursive') === 'false' ? 'indirect' : 'recursive') as PinType;
    if (!this.blocks.has(cid)) {
      sendJson(res, 500, { Message: 'pin: block not found', Code: 0, Type: 'error' });
      return;
    }
    const prev = this.pins.get(cid)?.type ?? 'recursive';
    this.pins.set(cid, { cid, type: prev === 'direct' ? 'direct' : type });
    sendJson(res, 200, {
      Pins: Array.from(this.pins.keys()).filter((c) => c === cid),
    });
  }

  private handlePinRm(url: URL, res: ServerResponse): void {
    const cid = url.searchParams.get('arg') ?? '';
    if (!this.pins.has(cid)) {
      sendJson(res, 500, { Message: 'not pinned or pinned indirectly', Code: 0, Type: 'error' });
      return;
    }
    this.pins.delete(cid);
    sendJson(res, 200, { Pins: [] });
  }

  private handlePinLs(url: URL, res: ServerResponse): void {
    const arg = url.searchParams.get('arg');
    const type = url.searchParams.get('type') ?? 'all';

    const keys: Record<string, { Type: string }> = {};
    for (const pin of this.pins.values()) {
      if (arg && pin.cid !== arg) continue;
      if (type !== 'all' && pin.type !== type) continue;
      keys[pin.cid] = { Type: pin.type };
    }
    sendJson(res, 200, { Keys: keys });
  }
}

/**
 * Extract the filename from a multipart/form-data body. The uploaded file's
 * filename is embedded in the Content-Disposition header.
 */
function extractFileName(raw: Buffer): string | null {
  const header = raw.toString('latin1', 0, 1024);
  const match = header.match(/filename="([^"]*)"/);
  return match ? match[1] : null;
}

/**
 * Strip multipart/form-data framing from a body and return the raw file bytes.
 * Locates the part whose Content-Disposition names the "file" field and slices
 * the exact byte range between the header terminator and the boundary framing.
 */
function stripMultipartData(raw: Buffer): Buffer {
  const text = raw.toString('latin1');
  const boundaryMatch = text.match(/^--([^\r\n]+)\r\n/);
  if (!boundaryMatch) {
    return raw;
  }
  const boundary = `--${boundaryMatch[1]}`;

  const fileHeaderIndex = text.indexOf('name="file"');
  if (fileHeaderIndex === -1) {
    return Buffer.alloc(0);
  }

  const headerEnd = text.indexOf('\r\n\r\n', fileHeaderIndex);
  if (headerEnd === -1) {
    return Buffer.alloc(0);
  }

  const dataStart = headerEnd + 4;
  const closing = text.indexOf(`\r\n${boundary}`, dataStart);
  const dataEnd = closing === -1 ? raw.length : closing;

  return raw.subarray(dataStart, dataEnd);
}
