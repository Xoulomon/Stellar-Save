/**
 * useTransaction.ts
 *
 * React hook for handling Stellar transaction submission and tracking.
 *
 * Features:
 * - Submit transactions with automatic signing via Freighter
 * - Track transaction status (idle, signing, submitting, pending, success, failed)
 * - Handle errors with user-friendly messages
 * - Show notifications for transaction events
 * - Support for custom transaction builders
 */

import { useState, useCallback } from 'react';
import {
  TransactionBuilder,
  xdr,
  SorobanRpc,
  BASE_FEE,
  Networks,
} from '@stellar/stellar-sdk';
import * as freighterApi from '@stellar/freighter-api';
import { useWallet } from './useWallet';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TransactionStatus =
  | 'idle'
  | 'signing'
  | 'submitting'
  | 'pending'
  | 'success'
  | 'failed';

export interface TransactionResult {
  txHash: string | null;
  error: string | null;
  status: TransactionStatus;
}

export interface UseTransactionReturn {
  status: TransactionStatus;
  txHash: string | null;
  error: string | null;
  isLoading: boolean;
  submitTransaction: (buildTx: () => Promise<xdr.Operation>) => Promise<TransactionResult>;
  reset: () => void;
}

// ─── Configuration ────────────────────────────────────────────────────────────

const RPC_URL: string =
  (import.meta.env['VITE_STELLAR_RPC_URL'] as string | undefined) ??
  'https://soroban-testnet.stellar.org';

const NETWORK_PASSPHRASE: string =
  (import.meta.env['VITE_STELLAR_NETWORK'] as string | undefined) === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;

const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });

// ─── Notification System ──────────────────────────────────────────────────────

/**
 * Simple notification system. Replace with a proper toast library if available.
 */
function showNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
  // TODO: Replace with proper notification system (react-toastify, etc.)
  const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  console.log(`${prefix} ${message}`);

  // For now, use browser alert for errors
  if (type === 'error') {
    alert(message);
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTransaction(): UseTransactionReturn {
  const { activeAddress, status: walletStatus } = useWallet();
  const [transactionStatus, setTransactionStatus] = useState<TransactionStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isLoading = transactionStatus === 'signing' || transactionStatus === 'submitting' || transactionStatus === 'pending';

  const reset = useCallback(() => {
    setTransactionStatus('idle');
    setTxHash(null);
    setError(null);
  }, []);

  const submitTransaction = useCallback(
    async (buildTx: () => Promise<xdr.Operation>): Promise<TransactionResult> => {
      if (walletStatus !== 'connected' || !activeAddress) {
        const errorMsg = 'Wallet is not connected';
        setError(errorMsg);
        setTransactionStatus('failed');
        showNotification(errorMsg, 'error');
        return { txHash: null, error: errorMsg, status: 'failed' };
      }

      try {
        reset();
        setTransactionStatus('signing');
        showNotification('Preparing transaction...', 'info');

        // Build the operation
        const operation = await buildTx();

        // Fetch source account
        const account = await server.getAccount(activeAddress);

        // Build transaction
        const tx = new TransactionBuilder(account, {
          fee: BASE_FEE,
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(operation)
          .setTimeout(30)
          .build();

        // Simulate to get resource fees
        setTransactionStatus('submitting');
        showNotification('Simulating transaction...', 'info');

        const simResult = await server.simulateTransaction(tx);

        if (SorobanRpc.Api.isSimulationError(simResult)) {
          const errorMsg = `Transaction simulation failed: ${simResult.error}`;
          setError(errorMsg);
          setTransactionStatus('failed');
          showNotification(errorMsg, 'error');
          return { txHash: null, error: errorMsg, status: 'failed' };
        }

        // Assemble transaction with simulation result
        const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();

        // Sign with Freighter
        showNotification('Please sign the transaction in Freighter', 'info');

        const freighter = freighterApi as unknown as Record<string, unknown>;
        const signFn = freighter['signTransaction'] as
          | ((xdr: string, opts: { networkPassphrase: string }) => Promise<unknown>)
          | undefined;

        if (!signFn) {
          const errorMsg = 'Freighter signing is not available';
          setError(errorMsg);
          setTransactionStatus('failed');
          showNotification(errorMsg, 'error');
          return { txHash: null, error: errorMsg, status: 'failed' };
        }

        const signResult = await signFn(preparedTx.toXDR(), {
          networkPassphrase: NETWORK_PASSPHRASE,
        });

        // Handle Freighter response
        let signedXdr: string;
        if (typeof signResult === 'string') {
          signedXdr = signResult;
        } else if (
          signResult &&
          typeof signResult === 'object' &&
          'signedTxXdr' in (signResult as object)
        ) {
          signedXdr = (signResult as { signedTxXdr: string }).signedTxXdr;
        } else {
          const errorMsg = 'Unexpected response from Freighter';
          setError(errorMsg);
          setTransactionStatus('failed');
          showNotification(errorMsg, 'error');
          return { txHash: null, error: errorMsg, status: 'failed' };
        }

        // Submit transaction
        setTransactionStatus('pending');
        showNotification('Submitting transaction...', 'info');

        const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
        const sendResult = await server.sendTransaction(signedTx);

        if (sendResult.status === 'ERROR') {
          const errorMsg = `Transaction submission failed: ${sendResult.errorResult?.toXDR() ?? 'Unknown error'}`;
          setError(errorMsg);
          setTransactionStatus('failed');
          showNotification(errorMsg, 'error');
          return { txHash: null, error: errorMsg, status: 'failed' };
        }

        const hash = sendResult.hash;
        setTxHash(hash);
        showNotification(`Transaction submitted: ${hash}`, 'info');

        // Poll for confirmation
        let getResult = await server.getTransaction(hash);

        for (
          let i = 0;
          i < 20 && getResult.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND;
          i++
        ) {
          await new Promise<void>((r) => setTimeout(r, 1500));
          getResult = await server.getTransaction(hash);
        }

        if (getResult.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
          const errorMsg = 'Transaction failed on-chain';
          setError(errorMsg);
          setTransactionStatus('failed');
          showNotification(errorMsg, 'error');
          return { txHash: hash, error: errorMsg, status: 'failed' };
        }

        if (getResult.status !== SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
          const errorMsg = 'Transaction did not confirm in time';
          setError(errorMsg);
          setTransactionStatus('failed');
          showNotification(errorMsg, 'error');
          return { txHash: hash, error: errorMsg, status: 'failed' };
        }

        // Success!
        setTransactionStatus('success');
        showNotification('Transaction confirmed successfully!', 'success');
        return { txHash: hash, error: null, status: 'success' };

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(errorMsg);
        setTransactionStatus('failed');
        showNotification(errorMsg, 'error');
        return { txHash: null, error: errorMsg, status: 'failed' };
      }
    },
    [activeAddress, walletStatus, reset]
  );

  return {
    status: transactionStatus,
    txHash,
    error,
    isLoading,
    submitTransaction,
    reset,
  };
}