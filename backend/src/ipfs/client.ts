import { config } from '../config';
import { logger } from '../logger';

export interface IpfsAddResult {
  cid: string;
  size: number;
}

export interface IpfsPinResult {
  cid: string;
  pinned: boolean;
}

export interface IpfsPinStatus {
  cid: string;
  type: 'direct' | 'recursive' | 'indirect';
}

async function ipfsFetch(
  baseUrl: string,
  path: string,
  options: { method?: string; body?: FormData; timeout?: number } = {},
): Promise<Response> {
  const url = new URL(`${baseUrl}${path}`);
  const { method = 'POST', body, timeout = 30000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url.toString(), {
      method,
      body,
      signal: controller.signal,
      headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function ipfsJson<T>(
  baseUrl: string,
  path: string,
  options: { method?: string; body?: FormData; timeout?: number } = {},
): Promise<T> {
  const res = await ipfsFetch(baseUrl, path, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`IPFS API error ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export class IpfsClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl?: string, timeout?: number) {
    this.baseUrl = baseUrl ?? config.ipfs.apiUrl;
    this.timeout = timeout ?? config.ipfs.apiTimeoutMs;
  }

  async add(data: string | Buffer, filename = 'metadata.json'): Promise<IpfsAddResult> {
    const formData = new FormData();
    const blob = typeof data === 'string' ? new Blob([data]) : new Blob([data]);
    formData.append('file', blob, filename);

    const result = await ipfsJson<{ Hash: string; Size: string }>(this.baseUrl, '/api/v0/add', {
      body: formData,
      timeout: this.timeout,
    });
    return { cid: result.Hash, size: parseInt(result.Size, 10) };
  }

  async pinAdd(cid: string, recursive = true): Promise<IpfsPinResult> {
    const params = new URLSearchParams({ arg: cid, recursive: String(recursive) });
    const result = await ipfsJson<{ Pins: string[] }>(
      this.baseUrl,
      `/api/v0/pin/add?${params.toString()}`,
      { timeout: this.timeout },
    );
    return { cid, pinned: result.Pins.includes(cid) };
  }

  async pinRm(cid: string, recursive = true): Promise<IpfsPinResult> {
    const params = new URLSearchParams({ arg: cid, recursive: String(recursive) });
    const result = await ipfsJson<{ Pins: string[] }>(
      this.baseUrl,
      `/api/v0/pin/rm?${params.toString()}`,
      { timeout: this.timeout },
    );
    return { cid, pinned: !result.Pins.includes(cid) };
  }

  async pinLs(cid?: string): Promise<IpfsPinStatus[]> {
    const params = new URLSearchParams();
    if (cid) params.set('arg', cid);
    params.set('type', 'all');

    const result = await ipfsJson<{ Keys: Record<string, { Type: string }> }>(
      this.baseUrl,
      `/api/v0/pin/ls?${params.toString()}`,
      { timeout: this.timeout },
    );
    return Object.entries(result.Keys ?? {}).map(([key, val]) => ({
      cid: key,
      type: val.Type as IpfsPinStatus['type'],
    }));
  }

  async cat(cid: string): Promise<string> {
    const res = await ipfsFetch(this.baseUrl, `/api/v0/cat?arg=${encodeURIComponent(cid)}`, {
      timeout: this.timeout,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`IPFS cat error ${res.status}: ${text}`);
    }
    return await res.text();
  }

  async id(): Promise<{ id: string; addresses: string[] }> {
    const result = await ipfsJson<{ ID: string; Addresses: string[] }>(
      this.baseUrl,
      '/api/v0/id',
      { timeout: this.timeout },
    );
    return { id: result.ID, addresses: result.Addresses };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.id();
      return true;
    } catch {
      return false;
    }
  }
}
