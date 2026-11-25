jest.mock('../logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

jest.mock('../prisma_client', () => ({
  prisma: {},
}));

import {
  ApiKeyService,
  DEFAULT_RATE_LIMITS,
  hashApiKey,
  maskApiKey,
  API_KEY_PREFIX,
} from '../api_key_service';

describe('ApiKeyService (Issue #2114)', () => {
  let mockDb: any;
  let mockLogger: any;
  let service: ApiKeyService;

  beforeEach(() => {
    mockDb = {
      apiKey: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      apiKeyUsage: {
        create: jest.fn(),
        groupBy: jest.fn(),
      },
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    service = new ApiKeyService({ db: mockDb, logger: mockLogger });
  });

  describe('utility functions', () => {
    it('hashApiKey computes deterministic sha256 hex string', () => {
      const hash1 = hashApiKey('ss_test_123');
      const hash2 = hashApiKey('ss_test_123');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('maskApiKey handles short and long keys safely', () => {
      expect(maskApiKey('')).toBe('');
      expect(maskApiKey('ss_short')).toBe('ss_short...');
      expect(maskApiKey('ss_1234567890abcdef123456')).toBe('ss_1234567890ab...');
    });
  });

  describe('generateKey', () => {
    it('generates an API key with correct prefix and rate limit for free tier', async () => {
      const mockCreated = {
        id: 'key-id-1',
        keyHash: 'hash-val',
        keyPrefix: 'ss_1234567890ab...',
        userId: 'user-1',
        name: 'Default Key',
        tier: 'free',
        rateLimit: 100,
        isActive: true,
        createdAt: new Date(),
      };
      mockDb.apiKey.create.mockResolvedValue(mockCreated);

      const result = await service.generateKey('user-1', 'Default Key', 'free');

      expect(result.key.startsWith(API_KEY_PREFIX)).toBe(true);
      expect(result.info).toEqual(mockCreated);
      expect(mockDb.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          name: 'Default Key',
          tier: 'free',
          rateLimit: DEFAULT_RATE_LIMITS.free,
          isActive: true,
        }),
      });
      expect(mockLogger.info).toHaveBeenCalledWith('API key generated', {
        userId: 'user-1',
        tier: 'free',
      });
    });

    it('supports pro and enterprise tiers with respective rate limits', async () => {
      mockDb.apiKey.create.mockResolvedValue({});

      await service.generateKey('user-2', 'Pro Key', 'pro');
      expect(mockDb.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tier: 'pro',
          rateLimit: DEFAULT_RATE_LIMITS.pro,
        }),
      });

      await service.generateKey('user-3', 'Enterprise Key', 'enterprise');
      expect(mockDb.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tier: 'enterprise',
          rateLimit: DEFAULT_RATE_LIMITS.enterprise,
        }),
      });
    });

    it('validates userId and name presence', async () => {
      await expect(service.generateKey('', 'Name')).rejects.toThrow('userId is required');
      await expect(service.generateKey('user-1', '')).rejects.toThrow('name is required');
    });
  });

  describe('validateKey', () => {
    it('fast-fails without DB call for malformed or missing keys', async () => {
      expect(await service.validateKey('')).toEqual({ valid: false });
      expect(await service.validateKey('bad_prefix_123')).toEqual({ valid: false });
      expect(mockDb.apiKey.findUnique).not.toHaveBeenCalled();
    });

    it('returns invalid when key is not found in DB', async () => {
      mockDb.apiKey.findUnique.mockResolvedValue(null);

      const result = await service.validateKey('ss_nonexistent_key_12345');
      expect(result).toEqual({ valid: false });
    });

    it('returns invalid when key is inactive', async () => {
      mockDb.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        isActive: false,
      });

      const result = await service.validateKey('ss_inactive_key_12345');
      expect(result).toEqual({ valid: false });
    });

    it('returns invalid when key has expired', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      mockDb.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        isActive: true,
        expiresAt: pastDate,
      });

      const result = await service.validateKey('ss_expired_key_12345');
      expect(result).toEqual({ valid: false });
    });

    it('returns valid and updates lastUsedAt for a valid key', async () => {
      mockDb.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        userId: 'user-1',
        rateLimit: 100,
        isActive: true,
      });
      mockDb.apiKey.update.mockResolvedValue({});

      const result = await service.validateKey('ss_valid_key_12345');
      expect(result).toEqual({
        valid: true,
        keyId: 'key-1',
        userId: 'user-1',
        rateLimit: 100,
      });
      expect(mockDb.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-1' },
        data: { lastUsedAt: expect.any(Date) },
      });
    });
  });

  describe('getKeysForUser', () => {
    it('returns keys ordered by createdAt desc', async () => {
      const mockKeys = [{ id: 'k1' }, { id: 'k2' }];
      mockDb.apiKey.findMany.mockResolvedValue(mockKeys);

      const keys = await service.getKeysForUser('user-1');
      expect(keys).toEqual(mockKeys);
      expect(mockDb.apiKey.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns empty array when userId is empty', async () => {
      const keys = await service.getKeysForUser('');
      expect(keys).toEqual([]);
      expect(mockDb.apiKey.findMany).not.toHaveBeenCalled();
    });
  });

  describe('revokeKey', () => {
    it('updates isActive to false and logs event', async () => {
      mockDb.apiKey.update.mockResolvedValue({});

      await service.revokeKey('key-to-revoke');
      expect(mockDb.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-to-revoke' },
        data: { isActive: false },
      });
      expect(mockLogger.info).toHaveBeenCalledWith('API key revoked', { keyId: 'key-to-revoke' });
    });
  });

  describe('recordUsage and getUsageStats', () => {
    it('recordUsage inserts into apiKeyUsage table', async () => {
      mockDb.apiKeyUsage.create.mockResolvedValue({});

      await service.recordUsage('key-1', '/api/v1/groups', 'POST', 201);
      expect(mockDb.apiKeyUsage.create).toHaveBeenCalledWith({
        data: {
          keyId: 'key-1',
          endpoint: '/api/v1/groups',
          method: 'POST',
          statusCode: 201,
        },
      });
    });

    it('getUsageStats aggregates request counts by method', async () => {
      mockDb.apiKeyUsage.groupBy.mockResolvedValue([
        { method: 'GET', statusCode: 200, _count: { id: 10 } },
        { method: 'POST', statusCode: 201, _count: { id: 5 } },
      ]);

      const stats = await service.getUsageStats('key-1', 12);
      expect(stats.keyId).toBe('key-1');
      expect(stats.period.hours).toBe(12);
      expect(stats.requestsByMethod).toEqual({ GET: 10, POST: 5 });
      expect(stats.totalRequests).toBe(15);
    });
  });
});
