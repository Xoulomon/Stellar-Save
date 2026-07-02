import { SorobanRpc } from "@stellar/stellar-sdk";

export interface RpcEndpoint {
  url: string;
  region: string;
  healthy: boolean;
  latencyMs: number;
  errorCount: number;
  lastChecked: number;
}

const ENDPOINTS: RpcEndpoint[] = [
  { url: process.env.STELLAR_RPC_URL_US ?? "https://soroban-testnet.stellar.org", region: "us-east-1", healthy: true, latencyMs: 0, errorCount: 0, lastChecked: 0 },
  { url: process.env.STELLAR_RPC_URL_EU ?? "https://soroban-testnet.stellar.org", region: "eu-west-1", healthy: true, latencyMs: 0, errorCount: 0, lastChecked: 0 },
  { url: process.env.STELLAR_RPC_URL_AP ?? "https://soroban-testnet.stellar.org", region: "ap-southeast-1", healthy: true, latencyMs: 0, errorCount: 0, lastChecked: 0 },
];

const HEALTH_CHECK_INTERVAL_MS = 30_000;
const MAX_ERRORS_BEFORE_UNHEALTHY = 3;

async function checkEndpoint(ep: RpcEndpoint): Promise<void> {
  const start = Date.now();
  try {
    const server = new SorobanRpc.Server(ep.url, { allowHttp: true });
    await server.getHealth();
    ep.latencyMs = Date.now() - start;
    ep.healthy = true;
    ep.errorCount = 0;
  } catch {
    ep.errorCount += 1;
    if (ep.errorCount >= MAX_ERRORS_BEFORE_UNHEALTHY) {
      ep.healthy = false;
    }
  } finally {
    ep.lastChecked = Date.now();
  }
}

export async function runHealthChecks(): Promise<void> {
  await Promise.all(ENDPOINTS.map(checkEndpoint));
}

export function getHealthyEndpoint(): RpcEndpoint {
  const healthy = ENDPOINTS.filter((e) => e.healthy);
  if (healthy.length === 0) throw new Error("All RPC endpoints are unhealthy");
  // Pick lowest latency; treat 0 (never checked) as high
  return healthy.sort((a, b) => (a.latencyMs || Infinity) - (b.latencyMs || Infinity))[0];
}

export function getRpcServer(): SorobanRpc.Server {
  const ep = getHealthyEndpoint();
  return new SorobanRpc.Server(ep.url, { allowHttp: true });
}

export function getEndpointStatus(): RpcEndpoint[] {
  return ENDPOINTS.map((e) => ({ ...e }));
}

// Start periodic health checks
let _interval: ReturnType<typeof setInterval> | null = null;
export function startHealthCheckScheduler(): void {
  if (_interval) return;
  void runHealthChecks(); // immediate first run
  _interval = setInterval(() => void runHealthChecks(), HEALTH_CHECK_INTERVAL_MS);
}
export function stopHealthCheckScheduler(): void {
  if (_interval) { clearInterval(_interval); _interval = null; }
}
