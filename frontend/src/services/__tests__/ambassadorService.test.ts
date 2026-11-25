/**
 * Ambassador Service - Frontend Unit Tests
 *
 * Tests for the frontend ambassador service that consumes the API.
 * Verifies proper envelope handling and error processing.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';

import {
  getLeaderboard,
  getProfile,
  evaluateStatus,
  distributeReward,
  AmbassadorTier,
  type AmbassadorProfile,
  type EvaluationResult,
} from '../ambassadorService';

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

describe('Ambassador Service', () => {
  let fetchMock: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
    localStorage.clear();
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  describe('getLeaderboard', () => {
    it('should fetch and return leaderboard data', async () => {
      const mockLeaderboard: AmbassadorProfile[] = [
        {
          address: 'GBDLJSTEST1',
          tier: AmbassadorTier.Gold,
          reputationScore: 0.95,
          contributionCount: 30,
          referrals: 10,
          rewardsEarned: 5000,
          awardedAt: '2026-01-01T00:00:00Z',
        },
        {
          address: 'GBDLJSTEST2',
          tier: AmbassadorTier.Silver,
          reputationScore: 0.85,
          contributionCount: 15,
          referrals: 3,
          rewardsEarned: 2000,
          awardedAt: '2026-02-01T00:00:00Z',
        },
      ];

      const mockResponse = {
        data: mockLeaderboard,
        meta: { count: 2 },
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      const result = await getLeaderboard();

      expect(result).toEqual(mockLeaderboard);
      expect(result).toHaveLength(2);
      expect(result[0].tier).toBe(AmbassadorTier.Gold);
    });

    it('should return empty array when no ambassadors', async () => {
      const mockResponse = {
        data: [],
        meta: { count: 0 },
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      const result = await getLeaderboard();

      expect(result).toEqual([]);
    });

    it('should throw error on API failure', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, { status: 500, statusText: 'Internal Server Error' })
      );

      await expect(getLeaderboard()).rejects.toThrow(
        'Failed to fetch leaderboard: Internal Server Error'
      );
    });

    it('should throw error from envelope errors', async () => {
      const mockResponse = {
        data: null,
        errors: [
          {
            code: 'INTERNAL_ERROR',
            message: 'Database connection failed',
          },
        ],
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      await expect(getLeaderboard()).rejects.toThrow('Database connection failed');
    });
  });

  describe('getProfile', () => {
    it('should fetch and return ambassador profile', async () => {
      const mockProfile: AmbassadorProfile = {
        address: 'GBDLJSTEST1',
        tier: AmbassadorTier.Gold,
        reputationScore: 0.95,
        contributionCount: 30,
        referrals: 10,
        rewardsEarned: 5000,
        awardedAt: '2026-01-01T00:00:00Z',
      };

      const mockResponse = {
        data: mockProfile,
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      const result = await getProfile('GBDLJSTEST1');

      expect(result).toEqual(mockProfile);
      expect(result?.tier).toBe(AmbassadorTier.Gold);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/ambassadors/GBDLJSTEST1'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should return null when profile not found (404)', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));

      const result = await getProfile('GBDLJSNOTFOUND');

      expect(result).toBeNull();
    });

    it('should throw error on API failure', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, { status: 500, statusText: 'Internal Server Error' })
      );

      await expect(getProfile('GBDLJSTEST1')).rejects.toThrow(
        'Failed to fetch profile: Internal Server Error'
      );
    });

    it('should throw error from envelope errors', async () => {
      const mockResponse = {
        data: null,
        errors: [
          {
            code: 'PROFILE_ERROR',
            message: 'Failed to load profile',
          },
        ],
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      await expect(getProfile('GBDLJSTEST1')).rejects.toThrow('Failed to load profile');
    });
  });

  describe('evaluateStatus', () => {
    beforeEach(() => {
      localStorage.setItem('auth_token', 'mock-jwt-token');
    });

    it('should evaluate ambassador status and return result', async () => {
      const mockResult: EvaluationResult = {
        eligible: true,
        tier: AmbassadorTier.Silver,
        profile: {
          address: 'GBDLJSTEST1',
          tier: AmbassadorTier.Silver,
          reputationScore: 0.85,
          contributionCount: 15,
          referrals: 3,
          rewardsEarned: 0,
          awardedAt: '2026-09-26T10:00:00Z',
        },
      };

      const mockResponse = {
        data: mockResult,
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      const result = await evaluateStatus('GBDLJSTEST1', 0.85, 15, 3);

      expect(result.eligible).toBe(true);
      expect(result.tier).toBe(AmbassadorTier.Silver);
      expect(result.profile?.address).toBe('GBDLJSTEST1');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/ambassadors/evaluate'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-jwt-token',
          }),
        })
      );
    });

    it('should return not eligible result', async () => {
      const mockResult: EvaluationResult = {
        eligible: false,
        tier: null,
        profile: null,
      };

      const mockResponse = {
        data: mockResult,
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      const result = await evaluateStatus('GBDLJSTEST1', 0.5, 2, 0);

      expect(result.eligible).toBe(false);
      expect(result.tier).toBeNull();
      expect(result.profile).toBeNull();
    });

    it('should throw error when not authenticated', async () => {
      localStorage.removeItem('auth_token');

      await expect(evaluateStatus('GBDLJSTEST1', 0.85, 15, 3)).rejects.toThrow(
        'Authentication required'
      );

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should throw error on API failure', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, { status: 401, statusText: 'Unauthorized' })
      );

      await expect(evaluateStatus('GBDLJSTEST1', 0.85, 15, 3)).rejects.toThrow(
        'Failed to evaluate status: Unauthorized'
      );
    });
  });

  describe('distributeReward', () => {
    beforeEach(() => {
      localStorage.setItem('auth_token', 'mock-jwt-token');
    });

    it('should distribute reward and return result', async () => {
      const mockResponse = {
        data: {
          rewarded: true,
          amount: 1000,
        },
        meta: { action: 'reward_distributed' },
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      const result = await distributeReward('GBDLJSTEST1', 1000);

      expect(result.rewarded).toBe(true);
      expect(result.amount).toBe(1000);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/ambassadors/GBDLJSTEST1/reward'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-jwt-token',
          }),
          body: JSON.stringify({ amount: 1000 }),
        })
      );
    });

    it('should throw error when not authenticated', async () => {
      localStorage.removeItem('auth_token');

      await expect(distributeReward('GBDLJSTEST1', 1000)).rejects.toThrow(
        'Authentication required'
      );

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should throw error on API failure', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 404, statusText: 'Not Found' }));

      await expect(distributeReward('GBDLJSTEST1', 1000)).rejects.toThrow(
        'Failed to distribute reward: Not Found'
      );
    });

    it('should throw error from envelope errors', async () => {
      const mockResponse = {
        data: null,
        errors: [
          {
            code: 'INVALID_AMOUNT',
            message: 'Amount must be positive',
          },
        ],
      };

      fetchMock.mockResolvedValueOnce(Response.json(mockResponse));

      await expect(distributeReward('GBDLJSTEST1', -100)).rejects.toThrow(
        'Amount must be positive'
      );
    });
  });
});
