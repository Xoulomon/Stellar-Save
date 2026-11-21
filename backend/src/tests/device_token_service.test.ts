/**
 * Unit tests for DeviceTokenService (Issue #1701)
 */

import { DeviceTokenService } from '../device_token_service';
import { createPrismaMock } from '../../tests/helpers/prismaMock';

describe('DeviceTokenService', () => {
  let mockDb: ReturnType<typeof createPrismaMock>;
  let mockLogger: any;
  let service: DeviceTokenService;

  beforeEach(() => {
    mockDb = createPrismaMock();
    mockDb.mobileDeviceToken.updateMany.mockResolvedValue({ count: 1 });
    mockDb.mobileDeviceToken.findMany.mockResolvedValue([
      {
        id: 'device-token-1',
        userId: 'user_1',
        token: 'tok_ios_123',
        platform: 'ios',
        isValid: true,
        lastUsedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    mockDb.mobileDeviceToken.deleteMany.mockResolvedValue({ count: 2 });
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };
    service = new DeviceTokenService({ db: mockDb, logger: mockLogger });
  });

  it('registers token with injected db and logger', async () => {
    await service.registerToken('user_1', 'tok_ios_123', 'ios');
    expect(mockDb.mobileDeviceToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: 'tok_ios_123' },
      })
    );
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('gets tokens for user via injected db', async () => {
    const tokens = await service.getTokensForUser('user_1');
    expect(tokens).toEqual([{ token: 'tok_ios_123', platform: 'ios' }]);
    expect(mockDb.mobileDeviceToken.findMany).toHaveBeenCalledWith({
      where: { userId: 'user_1', isValid: true },
      select: { token: true, platform: true },
    });
  });

  it('marks token invalid', async () => {
    await service.markTokenInvalid('tok_ios_123');
    expect(mockDb.mobileDeviceToken.updateMany).toHaveBeenCalledWith({
      where: { token: 'tok_ios_123' },
      data: { isValid: false },
    });
  });

  it('prunes expired tokens and logs count', async () => {
    await service.pruneExpiredTokens();
    expect(mockDb.mobileDeviceToken.deleteMany).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Pruned expired mobile tokens',
      { count: 2 }
    );
  });
});
