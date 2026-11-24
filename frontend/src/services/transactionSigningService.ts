import * as freighterApi from '@stellar/freighter-api';
import {
  BASE_FEE,
  Networks,
  TransactionBuilder,
  type xdr,
} from '@stellar/stellar-sdk';

import { env } from '../lib/env';

export const NETWORK_PASSPHRASE: string =
  env.VITE_STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

export const DUMMY_ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

export interface SignTransactionOptions {
  networkPassphrase?: string;
  address?: string;
}

export type TransactionSignerResult = string | { signedTxXdr?: unknown; signedTx?: unknown };

export type TransactionSigner = (
  transactionXdr: string,
  options?: SignTransactionOptions
) => Promise<TransactionSignerResult>;

export function normalizeSignedTransaction(result: unknown): string {
  if (typeof result === 'string' && result.length > 0) {
    return result;
  }

  if (result && typeof result === 'object') {
    const response = result as { signedTxXdr?: unknown; signedTx?: unknown };
    for (const candidate of [response.signedTxXdr, response.signedTx]) {
      if (typeof candidate === 'string' && candidate.length > 0) {
        return candidate;
      }
    }
  }

  throw new Error('Unexpected response from wallet signer.');
}

export async function signTransactionXdr(
  transactionXdr: string,
  signer: TransactionSigner,
  options: SignTransactionOptions = {}
): Promise<string> {
  const result = await signer(transactionXdr, {
    networkPassphrase: options.networkPassphrase ?? NETWORK_PASSPHRASE,
    address: options.address,
  });
  return normalizeSignedTransaction(result);
}

export function createFreighterSigner(
  api: Record<string, unknown> = freighterApi as unknown as Record<string, unknown>
): TransactionSigner {
  return (transactionXdr, options) => {
    const freighter = api;
    const signFn = freighter['signTransaction'] as
      | ((xdr: string, opts: { networkPassphrase: string }) => Promise<unknown>)
      | undefined;

    if (!signFn) {
      return Promise.reject(new Error('Freighter signTransaction is not available.'));
    }

    return signFn(transactionXdr, {
      networkPassphrase: options?.networkPassphrase ?? NETWORK_PASSPHRASE,
    }) as Promise<TransactionSignerResult>;
  };
}

export function buildTransaction(
  account: ConstructorParameters<typeof TransactionBuilder>[0],
  operations: xdr.Operation[],
  timeoutSeconds = 30
) {
  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  for (const operation of operations) {
    builder.addOperation(operation);
  }

  return builder.setTimeout(timeoutSeconds).build();
}
