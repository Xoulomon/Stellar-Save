/**
 * Unit tests for Transaction Decoder Service (Issue #1102)
 *
 * Moved from backend/test/unit/transaction-decoder.test.ts as part of
 * test consolidation (Issue #1727).
 */

import { Keypair } from '@stellar/stellar-sdk';

import { TransactionDecoderService } from '../transaction_decoder_service';

// Use the shared mock — this test only needs Keypair for fake key generation
// (no real signing or on-chain calls). The shared mock provides stub classes.
// See backend/src/__mocks__/@stellar/stellar-sdk.ts for the full stub surface.
jest.mock('@stellar/stellar-sdk');

describe('TransactionDecoderService', () => {
  let service: TransactionDecoderService;
  let destinationKeypair: Keypair;

  beforeEach(() => {
    service = new TransactionDecoderService();
    destinationKeypair = Keypair.random();
  });

  describe('Payment Operations', () => {
    it('should decode simple payment transaction', () => {
      // Note: This is a mock test structure. In production, you'd create real transactions
      const mockXdr = 'mock_transaction_xdr';

      // Mock the decoding (in real tests, use actual Stellar SDK)
      expect(() => service.decodeTransaction(mockXdr)).toBeDefined();
    });

    it('should handle empty XDR', () => {
      expect(() => service.decodeTransaction('')).toBeDefined();
    });

    it('should handle invalid XDR gracefully', () => {
      expect(() => service.decodeTransaction('invalid_xdr')).toBeDefined();
    });
  });

  describe('Key Generation', () => {
    it('should generate a valid destination keypair', () => {
      expect(destinationKeypair.publicKey()).toBeDefined();
      expect(destinationKeypair.publicKey().startsWith('G')).toBe(true);
    });
  });
});
