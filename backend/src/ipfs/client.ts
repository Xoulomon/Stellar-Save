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

export interface RetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

async function exponentialBackoff(
  attempt: number,
  config: Required<RetryConfig>,
): Promise<void> {
  const delayMs = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelayMs,
  );
  await new Promise(resolve => setTimeout(resolve, delayMs));
}

async function ipfsFetch(
  baseUrl: string,
  path: string,
  options: { method?: string; body?: FormData; timeout?: number; retryConfig?: RetryConfig } = {},
): Promise<Response> {
  const url = new URL(`${baseUrl}${path}`);
  const { method = 'POST', body, timeout = 30000, retryConfig } = options;
  const finalRetryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= finalRetryConfig.maxRetries; attempt++) {
    try {
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
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < finalRetryConfig.maxRetries) {
        await exponentialBackoff(attempt, finalRetryConfig);
        logger.debug('[ipfs] retrying after error', {
          attempt: attempt + 1,
          path,
          error: lastError.message,
        });
      }
    }
  }

  throw lastError || new Error('IPFS fetch failed');
}

async function ipfsJson<T>(
  baseUrl: string,
  path: string,
  options: { method?: string; body?: FormData; timeout?: number; retryConfig?: RetryConfig } = {},
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
  private retryConfig: Required<RetryConfig>;

  constructor(baseUrl?: string, timeout?: number, retryConfig?: RetryConfig) {
    this.baseUrl = baseUrl ?? config.ipfs.apiUrl;
    this.timeout = timeout ?? config.ipfs.apiTimeoutMs;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  async add(data: string | Buffer, filename = 'metadata.json'): Promise<IpfsAddResult> {
    const formData = new FormData();
    const blob = typeof data === 'string' ? new Blob([data]) : new Blob([data]);
    formData.append('file', blob, filename);

    const result = await ipfsJson<{ Hash: string; Size: string }>(this.baseUrl, '/api/v0/add', {
      body: formData,
      timeout: this.timeout,
      retryConfig: this.retryConfig,
    });
    return { cid: result.Hash, size: parseInt(result.Size, 10) };
  }

  async pinAdd(cid: string, recursive = true): Promise<IpfsPinResult> {
    const params = new URLSearchParams({ arg: cid, recursive: String(recursive) });
    const result = await ipfsJson<{ Pins: string[] }>(
      this.baseUrl,
      `/api/v0/pin/add?${params.toString()}`,
      { timeout: this.timeout, retryConfig: this.retryConfig },
    );
    return { cid, pinned: result.Pins.includes(cid) };
  }

  async pinRm(cid: string, recursive = true): Promise<IpfsPinResult> {
    const params = new URLSearchParams({ arg: cid, recursive: String(recursive) });
    const result = await ipfsJson<{ Pins: string[] }>(
      this.baseUrl,
      `/api/v0/pin/rm?${params.toString()}`,
      { timeout: this.timeout, retryConfig: this.retryConfig },
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
      { timeout: this.timeout, retryConfig: this.retryConfig },
    );
    return Object.entries(result.Keys ?? {}).map(([key, val]) => ({
      cid: key,
      type: val.Type as IpfsPinStatus['type'],
    }));
  }

  async cat(cid: string): Promise<string> {
    const res = await ipfsFetch(this.baseUrl, `/api/v0/cat?arg=${encodeURIComponent(cid)}`, {
      timeout: this.timeout,
      retryConfig: this.retryConfig,
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
      { timeout: this.timeout, retryConfig: this.retryConfig },
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
