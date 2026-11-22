import { prisma } from '../../src/prisma_client';
import { NotificationPreferenceRepository } from '../../src/modules/notifications/notification-preference.repository';
import { AnalyticsService } from '../../src/analytics_service';

jest.mock('../../src/redis', () => ({
  delPattern: jest.fn().mockResolvedValue(undefined),
}));

const analytics = new AnalyticsService(prisma);
const preferences = new NotificationPreferenceRepository(prisma);

describe('PostgreSQL-backed application flows', () => {
  it('persists group creation events', async () => {
    const createdAt = new Date();
    const event = await prisma.contractEvent.create({
      data: {
        contractId: 'integration-contract',
        eventType: 'group_created',
        topics: ['group_created'],
        data: {
          group_id: 'group-1',
          creator: 'creator-1',
          contribution_amount: 250,
          max_members: 8,
        },
        txHash: 'integration-group-creation',
        ledgerSeq: 1,
        timestamp: createdAt,
        blockTime: createdAt,
      },
    });

    await expect(
      prisma.contractEvent.findUnique({ where: { id: event.id } }),
    ).resolves.toMatchObject({
      eventType: 'group_created',
      contractId: 'integration-contract',
      data: {
        group_id: 'group-1',
        creator: 'creator-1',
        contribution_amount: 250,
        max_members: 8,
      },
    });
  });

  it('persists contribution records', async () => {
    await analytics.recordEvent(
      'transaction',
      'integration-contribution-1',
      'member-1',
      'group-1',
      { type: 'contribution', amount: 125 },
    );

    await expect(
      prisma.analyticsEvent.findFirst({ where: { eventName: 'integration-contribution-1' } }),
    ).resolves.toMatchObject({
      eventType: 'transaction',
      userId: 'member-1',
      groupId: 'group-1',
      eventData: { type: 'contribution', amount: 125 },
    });
  });

  it('reads notification preferences that were persisted', async () => {
    await preferences.create({
      userId: 'preference-user-1',
      emailNotifications: false,
      pushNotifications: true,
      unsubscribeToken: 'integration-token-1',
    });

    await expect(preferences.findByUserId('preference-user-1')).resolves.toMatchObject({
      userId: 'preference-user-1',
      emailNotifications: false,
      pushNotifications: true,
      unsubscribeToken: 'integration-token-1',
    });
  });
});
