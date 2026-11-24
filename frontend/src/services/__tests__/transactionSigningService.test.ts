import { Operation } from '@stellar/stellar-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSignTransaction = vi.fn();

vi.mock('@stellar/freighter-api', () => ({
  signTransaction: (...args: unknown[]) => mockSignTransaction(...args),
}));

import {
  buildTransaction,
  createFreighterSigner,
  NETWORK_PASSPHRASE,
  normalizeSignedTransaction,
  signTransactionXdr,
} from '../transactionSigningService';

describe('transactionSigningService', () => {
  beforeEach(() => {
    mockSignTransaction.mockReset();
  });

  describe('normalizeSignedTransaction', () => {
    it('accepts a raw XDR string', () => {
      expect(normalizeSignedTransaction('AAAA')).toBe('AAAA');
    });

    it('accepts the current signedTxXdr response shape', () => {
      expect(normalizeSignedTransaction({ signedTxXdr: 'CURRENT' })).toBe('CURRENT');
    });

    it('accepts the legacy signedTx response shape', () => {
      expect(normalizeSignedTransaction({ signedTx: 'LEGACY' })).toBe('LEGACY');
    });

    it('rejects empty and malformed responses', () => {
      expect(() => normalizeSignedTransaction('')).toThrow(/unexpected response/i);
      expect(() => normalizeSignedTransaction({})).toThrow(/unexpected response/i);
      expect(() => normalizeSignedTransaction(null)).toThrow(/unexpected response/i);
      expect(() => normalizeSignedTransaction({ signedTxXdr: 42 })).toThrow(/unexpected response/i);
    });
  });

  describe('signTransactionXdr', () => {
    it('passes the network passphrase to the signer and normalizes the result', async () => {
      const signer = vi.fn().mockResolvedValue({ signedTxXdr: 'SIGNED' });

      const result = await signTransactionXdr('XDR', signer, { address: 'GADDRESS' });

      expect(result).toBe('SIGNED');
      expect(signer).toHaveBeenCalledWith('XDR', {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: 'GADDRESS',
      });
    });

    it('honours a network passphrase override', async () => {
      const signer = vi.fn().mockResolvedValue('SIGNED');

      await signTransactionXdr('XDR', signer, { networkPassphrase: 'custom network' });

      expect(signer).toHaveBeenCalledWith('XDR', {
        networkPassphrase: 'custom network',
        address: undefined,
      });
    });

    it('propagates signer failures', async () => {
      const signer = vi.fn().mockRejectedValue(new Error('user rejected'));

      await expect(signTransactionXdr('XDR', signer)).rejects.toThrow('user rejected');
    });
  });

  describe('createFreighterSigner', () => {
    it('delegates signing to Freighter', async () => {
      mockSignTransaction.mockResolvedValue({ signedTxXdr: 'FREIGHTER_SIGNED' });

      const result = await signTransactionXdr('XDR', createFreighterSigner());

      expect(mockSignTransaction).toHaveBeenCalledWith('XDR', {
        networkPassphrase: NETWORK_PASSPHRASE,
      });
      expect(result).toBe('FREIGHTER_SIGNED');
    });

    it('reports a clear error when Freighter is unavailable', async () => {
      await expect(signTransactionXdr('XDR', createFreighterSigner({}))).rejects.toThrow(
        /Freighter signTransaction is not available/
      );
    });
  });

  describe('buildTransaction', () => {
    it('builds a transaction with the shared network passphrase and timeout', () => {
      const publicKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
      const account = {
        accountId: () => publicKey,
        sequenceNumber: () => '1',
        incrementSequenceNumber: () => undefined,
      };
      const operation = Operation.manageData({ name: 'key', value: 'value' });

      const tx = buildTransaction(account as never, [operation], 30);

      expect(tx.networkPassphrase).toBe(NETWORK_PASSPHRASE);
      expect(tx.operations).toHaveLength(1);
      expect(tx.timeBounds?.maxTime).toBeDefined();
    });
  });
});
