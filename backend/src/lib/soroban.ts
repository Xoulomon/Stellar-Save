import { rpc as SorobanRpc } from '@stellar/stellar-sdk';

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

  async withClient<T>(fn: (client: SorobanRpc.Server) => Promise<T>): Promise<T> {
    const client = await this.acquire();
    try {
      return await fn(client);
    } finally {
      this.release(client);
    }
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
      rpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
      poolSize: parseInt(process.env.SOROBAN_POOL_SIZE || '5'),
      acquireTimeoutMs: parseInt(process.env.SOROBAN_POOL_TIMEOUT_MS || '5000'),
    });
  }
  return _pool;
}

/** Reset the singleton (useful in tests). */
export function resetSorobanPool(): void {
  _pool = null;
}
