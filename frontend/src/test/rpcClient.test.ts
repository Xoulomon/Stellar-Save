import { describe, expect, it, vi } from 'vitest';

const ServerMock = vi.fn();

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>();
  return { ...actual, SorobanRpc: { ...actual.SorobanRpc, Server: ServerMock } };
});
vi.mock('../lib/env', () => ({
  env: { VITE_STELLAR_RPC_URL: 'https://rpc.example', VITE_STELLAR_NETWORK: 'testnet' },
}));

describe('rpcClient', () => {
  it('builds servers with shared defaults', async () => {
    const { createRpcServer, rpcServer } = await import('../lib/rpcClient');

    expect(rpcServer).toBeInstanceOf(ServerMock);
    expect(ServerMock).toHaveBeenCalledWith('https://rpc.example', { allowHttp: false });

    createRpcServer('https://other.example');
    expect(ServerMock).toHaveBeenLastCalledWith('https://other.example', { allowHttp: false });
  });

  it('is the instance used by contractClient', async () => {
    const { rpcServer } = await import('../lib/rpcClient');
    const { server } = await import('../lib/contractClient');
    expect(server).toBe(rpcServer);
  });
});
