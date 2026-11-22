import { withRetry } from '@stellar-save/shared-utils';

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
  /**
   * Number of retries *after* the initial attempt, so 2 means up to 3 calls in
   * total. Retained as-is for backwards compatibility; the shared utility
   * counts total attempts instead, so this is translated at the call site.
   */
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

async function ipfsFetch(
  baseUrl: string,
  path: string,
  options: { method?: string; body?: FormData; timeout?: number; retryConfig?: RetryConfig } = {}
): Promise<Response> {
  const url = new URL(`${baseUrl}${path}`);
  const { method = 'POST', body, timeout = 30000, retryConfig } = options;
  const finalRetryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };

  return withRetry(
    async () => {
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
    },
    {
      // `maxRetries` excludes the initial attempt; `withRetry` counts it.
      attempts: finalRetryConfig.maxRetries + 1,
      initialDelayMs: finalRetryConfig.initialDelayMs,
      maxDelayMs: finalRetryConfig.maxDelayMs,
      backoffMultiplier: finalRetryConfig.backoffMultiplier,
      // Delays here stay deterministic: the client's tests assert on wall-clock
      // elapsed time, and IPFS pinning is not a high-contention path where
      // lockstep retries are a concern.
      jitter: 0,
      onRetry: ({ attempt, error }) => {
        logger.debug('[ipfs] retrying after error', {
          attempt: attempt + 1,
          path,
          error: error instanceof Error ? error.message : String(error),
        });
      },
    }
  ).catch((error: unknown) => {
    // `withRetry` rethrows the original value, but this client has always
    // surfaced an Error, and callers read `.message` off it.
    throw error instanceof Error ? error : new Error(String(error));
  });
}

async function ipfsJson<T>(
  baseUrl: string,
  path: string,
  options: { method?: string; body?: FormData; timeout?: number; retryConfig?: RetryConfig } = {}
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
      { timeout: this.timeout, retryConfig: this.retryConfig }
    );
    return { cid, pinned: result.Pins.includes(cid) };
  }

  async pinRm(cid: string, recursive = true): Promise<IpfsPinResult> {
    const params = new URLSearchParams({ arg: cid, recursive: String(recursive) });
    const result = await ipfsJson<{ Pins: string[] }>(
      this.baseUrl,
      `/api/v0/pin/rm?${params.toString()}`,
      { timeout: this.timeout, retryConfig: this.retryConfig }
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
      { timeout: this.timeout, retryConfig: this.retryConfig }
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
    const result = await ipfsJson<{ ID: string; Addresses: string[] }>(this.baseUrl, '/api/v0/id', {
      timeout: this.timeout,
      retryConfig: this.retryConfig,
    });
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
