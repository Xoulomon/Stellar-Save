import {
  NotificationPreferenceRepository,
  NotificationPreferencePrisma,
} from '../modules/notifications/notification-preference.repository';

function mockDb() {
  return {
    notificationPreference: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };
}

describe('NotificationPreferenceRepository', () => {
  let db: ReturnType<typeof mockDb>;
  let repo: NotificationPreferenceRepository;

  beforeEach(() => {
    db = mockDb();
    repo = new NotificationPreferenceRepository(db as unknown as NotificationPreferencePrisma);
  });

  it('findByUserId queries by userId', async () => {
    db.notificationPreference.findUnique.mockResolvedValue({ userId: 'u1' });
    await repo.findByUserId('u1');
    expect(db.notificationPreference.findUnique).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });

  it('findByUnsubscribeToken queries by unsubscribeToken', async () => {
    db.notificationPreference.findUnique.mockResolvedValue(null);
    await repo.findByUnsubscribeToken('tok-123');
    expect(db.notificationPreference.findUnique).toHaveBeenCalledWith({
      where: { unsubscribeToken: 'tok-123' },
    });
  });

  it('updateByUserId / updateById target the right key', async () => {
    db.notificationPreference.update.mockResolvedValue({});
    await repo.updateByUserId('u1', { emailNotifications: false });
    expect(db.notificationPreference.update).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { emailNotifications: false },
    });

    await repo.updateById('pref-9', { pushNotifications: false });
    expect(db.notificationPreference.update).toHaveBeenCalledWith({
      where: { id: 'pref-9' },
      data: { pushNotifications: false },
    });
  });

  it('userIdsForDigest filters on opt-in + frequency and projects userId', async () => {
    db.notificationPreference.findMany.mockResolvedValue([{ userId: 'a' }, { userId: 'b' }]);

    await expect(repo.userIdsForDigest('daily')).resolves.toEqual(['a', 'b']);
    expect(db.notificationPreference.findMany).toHaveBeenCalledWith({
      where: { emailNotifications: true, emailFrequency: 'daily' },
      select: { userId: true },
    });
  });

  it('updateManyByUserIds uses an `in` filter and returns the count', async () => {
    db.notificationPreference.updateMany.mockResolvedValue({ count: 3 });

    await expect(
      repo.updateManyByUserIds(['a', 'b', 'c'], { emailFrequency: 'weekly' }),
    ).resolves.toBe(3);
    expect(db.notificationPreference.updateMany).toHaveBeenCalledWith({
      where: { userId: { in: ['a', 'b', 'c'] } },
      data: { emailFrequency: 'weekly' },
    });
  });

  it('count passes a where clause only when provided', async () => {
    db.notificationPreference.count.mockResolvedValue(0);
    await repo.count();
    expect(db.notificationPreference.count).toHaveBeenCalledWith(undefined);

    await repo.count({ emailNotifications: true });
    expect(db.notificationPreference.count).toHaveBeenCalledWith({ where: { emailNotifications: true } });
  });
});
