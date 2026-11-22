/**
 * rpcClient.ts
 *
 * Single factory for Soroban RPC clients so every service shares the same
 * endpoint and transport options.
 */

import { SorobanRpc } from '@stellar/stellar-sdk';

import { env } from './env';

export function createRpcServer(url: string = env.VITE_STELLAR_RPC_URL): SorobanRpc.Server {
  return new SorobanRpc.Server(url, { allowHttp: false });
}

/** Shared Soroban RPC server instance. */
export const rpcServer = createRpcServer();
