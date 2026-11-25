/**
 * Compliance Service - Frontend Unit Tests
 *
 * Tests for the frontend compliance service that consumes the API.
 * Verifies proper envelope handling and error processing.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import {
  screenTransaction,
  getFlaggedTransactions,
  reviewFlag,
  getAuditLog,
  RiskLevel,
  type AmlCheckResult,
  type ComplianceFlag,
} from '../complianceService';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Compliance Service', () => {
  let fetchMock: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
    localStorage.clear();
    localStorage.setItem('auth_token', 'mock-jwt-token');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  describe('screenTransaction', () => {
    it('should screen transaction and return clean result', async () => {
      const mockResult: AmlCheckResult = {
        flagged: false,
        riskLevel: RiskLevel.LOW,
        reasons: [],
      };

      const mockResponse = {
        data: mockResult,
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      const result = await screenTransaction('GBDLJSTEST1', 'txhash123', 100);

      expect(result.flagged).toBe(false);
      expect(result.riskLevel).toBe(RiskLevel.LOW);
      expect(result.reasons).toEqual([]);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/compliance/screen'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-jwt-token',
          }),
          body: JSON.stringify({
            address: 'GBDLJSTEST1',
            txHash: 'txhash123',
            amount: 100,
          }),
        })
      );
    });

    it('should screen transaction and flag it', async () => {
      const mockResult: AmlCheckResult = {
        flagged: true,
        riskLevel: RiskLevel.HIGH,
        reasons: ['high_value', 'rapid_succession'],
      };

      const mockResponse = {
        data: mockResult,
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      const result = await screenTransaction('GBDLJSTEST1', 'txhash123', 15000);

      expect(result.flagged).toBe(true);
      expect(result.riskLevel).toBe(RiskLevel.HIGH);
      expect(result.reasons).toContain('high_value');
      expect(result.reasons).toContain('rapid_succession');
    });

    it('should flag critical risk transaction', async () => {
      const mockResult: AmlCheckResult = {
        flagged: true,
        riskLevel: RiskLevel.CRITICAL,
        reasons: ['sanctioned_address'],
      };

      const mockResponse = {
        data: mockResult,
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      const result = await screenTransaction('GBADsanctioned1X', 'txhash123', 100);

      expect(result.flagged).toBe(true);
      expect(result.riskLevel).toBe(RiskLevel.CRITICAL);
      expect(result.reasons).toContain('sanctioned_address');
    });

    it('should throw error when not authenticated', async () => {
      localStorage.removeItem('auth_token');

      await expect(screenTransaction('GBDLJSTEST1', 'txhash123', 100)).rejects.toThrow(
        'Authentication required'
      );

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should throw error on API failure', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, { status: 400, statusText: 'Bad Request' })
      );

      await expect(screenTransaction('GBDLJSTEST1', 'txhash123', 100)).rejects.toThrow(
        'Failed to screen transaction: Bad Request'
      );
    });

    it('should throw error from envelope errors', async () => {
      const mockResponse = {
        data: null,
        errors: [
          {
            code: 'INVALID_ADDRESS',
            message: 'Invalid Stellar address format',
          },
        ],
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      await expect(screenTransaction('INVALID', 'txhash123', 100)).rejects.toThrow(
        'Invalid Stellar address format'
      );
    });
  });

  describe('getFlaggedTransactions', () => {
    it('should fetch flagged transactions', async () => {
      const mockFlags: ComplianceFlag[] = [
        {
          id: 'flag-1',
          address: 'GBDLJSTEST1',
          txHash: 'txhash1',
          riskLevel: RiskLevel.HIGH,
          reasons: ['high_value'],
          timestamp: '2026-09-26T10:00:00Z',
          reviewed: false,
        },
        {
          id: 'flag-2',
          address: 'GBDLJSTEST2',
          txHash: 'txhash2',
          riskLevel: RiskLevel.MEDIUM,
          reasons: ['rapid_succession'],
          timestamp: '2026-09-26T10:05:00Z',
          reviewed: false,
        },
      ];

      const mockResponse = {
        data: mockFlags,
        meta: { count: 2 },
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      const result = await getFlaggedTransactions();

      expect(result).toEqual(mockFlags);
      expect(result).toHaveLength(2);
      expect(result[0].reviewed).toBe(false);
    });

    it('should return empty array when no flags', async () => {
      const mockResponse = {
        data: [],
        meta: { count: 0 },
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      const result = await getFlaggedTransactions();

      expect(result).toEqual([]);
    });

    it('should throw error when not authenticated', async () => {
      localStorage.removeItem('auth_token');

      await expect(getFlaggedTransactions()).rejects.toThrow('Authentication required');

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should throw error on API failure', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, { status: 401, statusText: 'Unauthorized' })
      );

      await expect(getFlaggedTransactions()).rejects.toThrow(
        'Failed to fetch flagged transactions: Unauthorized'
      );
    });
  });

  describe('reviewFlag', () => {
    it('should approve flagged transaction', async () => {
      const mockResponse = {
        data: {
          reviewed: true,
        },
        meta: { action: 'approved' },
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      const result = await reviewFlag('flag-1', 'approved', 'Legitimate transaction');

      expect(result).toBe(true);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/compliance/flags/flag-1/review'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-jwt-token',
          }),
          body: JSON.stringify({
            decision: 'approved',
            notes: 'Legitimate transaction',
          }),
        })
      );
    });

    it('should reject flagged transaction', async () => {
      const mockResponse = {
        data: {
          reviewed: true,
        },
        meta: { action: 'rejected' },
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      const result = await reviewFlag('flag-1', 'rejected', 'Suspicious activity detected');

      expect(result).toBe(true);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/compliance/flags/flag-1/review'),
        expect.objectContaining({
          body: JSON.stringify({
            decision: 'rejected',
            notes: 'Suspicious activity detected',
          }),
        })
      );
    });

    it('should review flag without notes', async () => {
      const mockResponse = {
        data: {
          reviewed: true,
        },
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      const result = await reviewFlag('flag-1', 'approved');

      expect(result).toBe(true);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/compliance/flags/flag-1/review'),
        expect.objectContaining({
          body: JSON.stringify({
            decision: 'approved',
            notes: undefined,
          }),
        })
      );
    });

    it('should throw error when not authenticated', async () => {
      localStorage.removeItem('auth_token');

      await expect(reviewFlag('flag-1', 'approved')).rejects.toThrow('Authentication required');

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should throw error on API failure', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 404, statusText: 'Not Found' }));

      await expect(reviewFlag('flag-1', 'approved')).rejects.toThrow(
        'Failed to review flag: Not Found'
      );
    });

    it('should throw error from envelope errors', async () => {
      const mockResponse = {
        data: null,
        errors: [
          {
            code: 'FLAG_NOT_FOUND',
            message: 'Flag does not exist',
          },
        ],
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      await expect(reviewFlag('flag-999', 'approved')).rejects.toThrow('Flag does not exist');
    });
  });

  describe('getAuditLog', () => {
    it('should fetch audit log with reviewed flags', async () => {
      const mockLogs: ComplianceFlag[] = [
        {
          id: 'flag-1',
          address: 'GBDLJSTEST1',
          txHash: 'txhash1',
          riskLevel: RiskLevel.HIGH,
          reasons: ['high_value'],
          timestamp: '2026-09-26T10:00:00Z',
          reviewed: true,
          reviewedBy: 'admin@example.com',
          decision: 'approved',
          notes: 'Legitimate transaction',
        },
        {
          id: 'flag-2',
          address: 'GBDLJSTEST2',
          txHash: 'txhash2',
          riskLevel: RiskLevel.MEDIUM,
          reasons: ['rapid_succession'],
          timestamp: '2026-09-26T10:05:00Z',
          reviewed: true,
          reviewedBy: 'admin@example.com',
          decision: 'rejected',
          notes: 'Suspicious pattern detected',
        },
      ];

      const mockResponse = {
        data: mockLogs,
        meta: { count: 2 },
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      const result = await getAuditLog();

      expect(result).toEqual(mockLogs);
      expect(result).toHaveLength(2);
      expect(result[0].reviewed).toBe(true);
      expect(result[0].decision).toBe('approved');
      expect(result[1].decision).toBe('rejected');
    });

    it('should return empty audit log', async () => {
      const mockResponse = {
        data: [],
        meta: { count: 0 },
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      const result = await getAuditLog();

      expect(result).toEqual([]);
    });

    it('should throw error when not authenticated', async () => {
      localStorage.removeItem('auth_token');

      await expect(getAuditLog()).rejects.toThrow('Authentication required');

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should throw error on API failure', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, { status: 500, statusText: 'Internal Server Error' })
      );

      await expect(getAuditLog()).rejects.toThrow(
        'Failed to fetch audit log: Internal Server Error'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle multiple error conditions', async () => {
      const mockResponse = {
        data: null,
        errors: [
          {
            code: 'VALIDATION_ERROR',
            message: 'Multiple validation errors',
            details: {
              fields: ['address', 'amount'],
            },
          },
        ],
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      await expect(screenTransaction('INVALID', 'INVALID', -100)).rejects.toThrow(
        'Multiple validation errors'
      );
    });

    it('should handle network errors gracefully', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(getFlaggedTransactions()).rejects.toThrow();
    });
  });
});
