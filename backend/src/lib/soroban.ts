import { rpc as SorobanRpc } from '@stellar/stellar-sdk';
import { withSpan } from '../tracing';
import { config } from '../config';

export interface SorobanPoolConfig {
  rpcUrl: string;
  poolSize?: number;
  acquireTimeoutMs?: number;
}

export interface PoolMetrics {
  total: number;
  available: number;
  inUse: number;
  acquireTimeouts: number;
  utilizationPct: number;
}

type Waiter = (client: SorobanRpc.Server) => void;

export class SorobanClientPool {
  private readonly pool: SorobanRpc.Server[] = [];
  private readonly waiters: Array<{ resolve: Waiter; timer: ReturnType<typeof setTimeout> }> = [];
  private inUse = 0;
  private acquireTimeouts = 0;
  private readonly total: number;
  private readonly acquireTimeoutMs: number;

  constructor(config: SorobanPoolConfig) {
    this.total = config.poolSize ?? 5;
    this.acquireTimeoutMs = config.acquireTimeoutMs ?? 5000;

    for (let i = 0; i < this.total; i++) {
      this.pool.push(new SorobanRpc.Server(config.rpcUrl, { allowHttp: config.rpcUrl.startsWith('http://') }));
    }
  }

  acquire(): Promise<SorobanRpc.Server> {
    if (this.pool.length > 0) {
      const client = this.pool.pop()!;
      this.inUse++;
      return Promise.resolve(client);
    }

    return new Promise<SorobanRpc.Server>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex(w => w.timer === timer);
        if (idx !== -1) this.waiters.splice(idx, 1);
        this.acquireTimeouts++;
        reject(new Error(`SorobanClientPool: acquire timed out after ${this.acquireTimeoutMs}ms`));
      }, this.acquireTimeoutMs);

      this.waiters.push({ resolve, timer });
    });
  }

  release(client: SorobanRpc.Server): void {
    if (this.waiters.length > 0) {
      const waiter = this.waiters.shift()!;
      clearTimeout(waiter.timer);
      waiter.resolve(client);
      return;
    }
    this.inUse--;
    this.pool.push(client);
  }

  /**
   * Run `fn` with a pooled Soroban RPC client, wrapped in an OpenTelemetry span
   * so contract-execution latency (simulate / invoke) shows up in the trace.
   *
   * Full in-wasm contract tracing is not possible, so this span around the host
   * RPC call is the distributed-tracing boundary for contract execution. Pass
   * the contract function name as `op` (e.g. `contribute`) to label the span and
   * carry the active trace context to the RPC node.
   *
   * @param fn  Work to perform with the client
   * @param op  Optional contract function / RPC operation name for the span
   */
  async withClient<T>(
    fn: (client: SorobanRpc.Server) => Promise<T>,
    op?: string,
  ): Promise<T> {
    return withSpan(
      op ? `soroban.invoke ${op}` : 'soroban.rpc',
      { 'rpc.system': 'soroban', ...(op ? { 'soroban.function': op } : {}) },
      async () => {
        const client = await this.acquire();
        try {
          return await fn(client);
        } finally {
          this.release(client);
        }
      },
    );
  }

  metrics(): PoolMetrics {
    const available = this.pool.length;
    return {
      total: this.total,
      available,
      inUse: this.inUse,
      acquireTimeouts: this.acquireTimeouts,
      utilizationPct: this.total > 0 ? Math.round((this.inUse / this.total) * 100) : 0,
    };
  }
}

// Singleton pool, lazily initialised
let _pool: SorobanClientPool | null = null;

export function getSorobanPool(): SorobanClientPool {
  if (!_pool) {
    _pool = new SorobanClientPool({
      rpcUrl: config.stellar.rpcUrl,
      poolSize: config.soroban.poolSize,
      acquireTimeoutMs: config.soroban.poolTimeoutMs,
    });
  }
  return _pool;
}

/** Reset the singleton (useful in tests). */
export function resetSorobanPool(): void {
  _pool = null;
}
