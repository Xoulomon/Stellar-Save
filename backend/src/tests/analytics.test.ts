import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { AnalyticsService } from '../analytics_service';
import { AnalyticsAggregator } from '../analytics_aggregator';
import * as redis from '../redis';

describe('AnalyticsService', () => {
  let prisma: PrismaClient;
  let analyticsService: AnalyticsService;

  beforeAll(() => {
    prisma = new PrismaClient();
    analyticsService = new AnalyticsService(prisma);
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.$executeRawUnsafe(
      'DELETE FROM "PlatformMetrics" WHERE "createdAt" > now() - interval \'1 day\''
    );
    await prisma.$executeRawUnsafe(
      'DELETE FROM "UserMetrics" WHERE "createdAt" > now() - interval \'1 day\''
    );
    await prisma.$executeRawUnsafe(
      'DELETE FROM "GroupMetrics" WHERE "createdAt" > now() - interval \'1 day\''
    );
    await prisma.$executeRawUnsafe(
      'DELETE FROM "AnalyticsEvent" WHERE "createdAt" > now() - interval \'1 day\''
    );
    await prisma.$executeRawUnsafe(
      'DELETE FROM "AnalyticsReport" WHERE "createdAt" > now() - interval \'1 day\''
    );
    await prisma.$disconnect();
  });

  describe('recordEvent', () => {
    it('should record an analytics event', async () => {
      const userId = 'test-user-' + Date.now();
      const eventType = 'page_view';
      const eventName = 'dashboard_view';

      await analyticsService.recordEvent(eventType, eventName, userId);

      const events = await prisma.analyticsEvent.findMany({
        where: { userId, eventType },
      });

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].eventName).toBe(eventName);
    });

    it('should record an analytics event with event data', async () => {
      const userId = 'test-user-' + Date.now();
      const eventData = { page: 'dashboard', duration: 30 };

      await analyticsService.recordEvent(
        'interaction',
        'button_click',
        userId,
        undefined,
        eventData
      );

      const events = await prisma.analyticsEvent.findMany({
        where: { userId },
      });

      expect(events[0].eventData).toEqual(eventData);
    });

    it('should handle missing event attributes gracefully', async () => {
      await analyticsService.recordEvent('purchase', 'checkout_completed');

      const events = await prisma.analyticsEvent.findMany({
        where: { eventType: 'purchase' },
      });

      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('getPlatformStats', () => {
    beforeAll(async () => {
      // Create platform metrics for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.platformMetrics.upsert({
        where: { date: today },
        create: {
          date: today,
          totalUsers: 100,
          activeUsers: 80,
          totalGroups: 20,
          activeGroups: 15,
          totalContributions: 500,
          totalContributionAmount: 5000,
          totalPayouts: 400,
          totalPayoutAmount: 4000,
          averageGroupSize: 5,
          successRate: 80,
          totalTransactions: 900,
          uniqueWallets: 60,
        },
        update: {},
      });
    });

    it('should retrieve platform statistics', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const stats = await analyticsService.getPlatformStats(today);

      expect(stats).toBeDefined();
      expect(stats?.totalUsers).toBeGreaterThan(0);
      expect(stats?.activeUsers).toBeLessThanOrEqual(stats?.totalUsers!);
    });

    it('should return null for non-existent date', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 100);

      const stats = await analyticsService.getPlatformStats(futureDate);

      expect(stats).toBeNull();
    });

    it('should cache platform stats', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // First call - should hit database
      const stats1 = await analyticsService.getPlatformStats(today);

      // Second call - should hit cache
      const stats2 = await analyticsService.getPlatformStats(today);

      expect(stats1).toEqual(stats2);
    });
  });

  describe('getUserStats', () => {
    beforeAll(async () => {
      const userId = 'test-analytics-user-1';
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.userMetrics.upsert({
        where: { userId_date: { userId, date: today } },
        create: {
          userId,
          date: today,
          groupsJoined: 5,
          groupsCreated: 2,
          groupsCompleted: 1,
          totalContributions: 10,
          totalContributionAmount: 500,
          totalPayoutsReceived: 400,
          sessionsCount: 8,
          sessionDurationMinutes: 120,
          pageViews: 50,
          interactionCount: 150,
        },
        update: {},
      });
    });

    it('should retrieve user statistics', async () => {
      const userId = 'test-analytics-user-1';
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const stats = await analyticsService.getUserStats(userId, today);

      expect(stats).toBeDefined();
      expect(stats?.userId).toBe(userId);
      expect(stats?.groupsJoined).toBeGreaterThan(0);
    });

    it('should return null for non-existent user', async () => {
      const nonExistentUserId = 'non-existent-user-' + Date.now();
      const today = new Date();

      const stats = await analyticsService.getUserStats(nonExistentUserId, today);

      expect(stats).toBeNull();
    });
  });

  describe('getGroupStats', () => {
    beforeAll(async () => {
      const groupId = 'test-analytics-group-1';
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.groupMetrics.upsert({
        where: { groupId_date: { groupId, date: today } },
        create: {
          groupId,
          date: today,
          memberCount: 10,
          totalContributions: 50,
          totalContributionAmount: 2500,
          totalPayoutsDistributed: 2000,
          successRate: 90,
          averageContributionSize: 50,
          newMembersCount: 3,
          churnCount: 1,
        },
        update: {},
      });
    });

    it('should retrieve group statistics', async () => {
      const groupId = 'test-analytics-group-1';
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const stats = await analyticsService.getGroupStats(groupId, today);

      expect(stats).toBeDefined();
      expect(stats?.groupId).toBe(groupId);
      expect(stats?.memberCount).toBeGreaterThan(0);
    });

    it('should return null for non-existent group', async () => {
      const nonExistentGroupId = 'non-existent-group-' + Date.now();
      const today = new Date();

      const stats = await analyticsService.getGroupStats(nonExistentGroupId, today);

      expect(stats).toBeNull();
    });
  });

  describe('getEventStats', () => {
    beforeAll(async () => {
      // Record multiple events
      for (let i = 0; i < 5; i++) {
        await analyticsService.recordEvent(
          'test_event',
          'test_action_' + i,
          'user-' + i
        );
      }
    });

    it('should retrieve event statistics', async () => {
      const stats = await analyticsService.getEventStats();

      expect(stats).toBeDefined();
      expect(Array.isArray(stats)).toBe(true);
    });

    it('should retrieve event statistics with date range', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
      const endDate = new Date();

      const stats = await analyticsService.getEventStats({
        startDate,
        endDate,
      });

      expect(stats).toBeDefined();
      expect(Array.isArray(stats)).toBe(true);
    });
  });

  describe('generateReport', () => {
    it('should generate an analytics report', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();

      const report = await analyticsService.generateReport(
        'weekly',
        'Weekly Analytics Report',
        startDate,
        endDate,
        'admin-user'
      );

      expect(report).toBeDefined();
      expect(report.reportType).toBe('weekly');
      expect(report.reportName).toBe('Weekly Analytics Report');
      expect(report.data.summary).toBeDefined();
    });

    it('should retrieve generated reports', async () => {
      const reports = await analyticsService.getReports('weekly');

      expect(Array.isArray(reports)).toBe(true);
    });
  });

  describe('getPlatformTrends', () => {
    beforeAll(async () => {
      // Create metrics for multiple days
      for (let i = 0; i < 5; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        await prisma.platformMetrics.upsert({
          where: { date },
          create: {
            date,
            totalUsers: 100 + i * 10,
            activeUsers: 80 + i * 5,
            totalGroups: 20,
            activeGroups: 15,
            totalContributions: 500 + i * 50,
            totalContributionAmount: 5000 + i * 500,
            totalPayouts: 400 + i * 40,
            totalPayoutAmount: 4000 + i * 400,
            averageGroupSize: 5,
            successRate: 80,
            totalTransactions: 900 + i * 90,
            uniqueWallets: 60 + i * 5,
          },
          update: {},
        });
      }
    });

    it('should retrieve platform trends', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const trends = await analyticsService.getPlatformTrends(startDate, endDate);

      expect(Array.isArray(trends)).toBe(true);
      expect(trends.length).toBeGreaterThan(0);
    });

    it('should apply pagination to trends', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const trends = await analyticsService.getPlatformTrends(startDate, endDate, {
        limit: 2,
        offset: 0,
      });

      expect(trends.length).toBeLessThanOrEqual(2);
    });
  });

  describe('cache operations', () => {
    it('should get cache statistics', async () => {
      const stats = await analyticsService.getCacheStats();

      expect(stats).toBeDefined();
      expect(typeof stats.hitRate).toBe('number');
    });

    it('should clear cache with pattern', async () => {
      await analyticsService.clearCache('platform_stats:*');
      // Should not throw
    });
  });
});

describe('AnalyticsAggregator', () => {
  let prisma: PrismaClient;
  let aggregator: AnalyticsAggregator;

  beforeAll(() => {
    prisma = new PrismaClient();
    aggregator = new AnalyticsAggregator(prisma, 3600000); // 1 hour interval
  });

  afterAll(async () => {
    aggregator.stop();
    await prisma.$disconnect();
  });

  describe('aggregation', () => {
    beforeAll(async () => {
      // Create test events
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      for (let i = 0; i < 10; i++) {
        await prisma.analyticsEvent.create({
          data: {
            eventType: i % 2 === 0 ? 'page_view' : 'click',
            eventName: 'test_event_' + i,
            userId: 'user-' + (i % 3),
            groupId: 'group-' + (i % 2),
            createdAt: new Date(
              yesterday.getTime() + Math.random() * 24 * 60 * 60 * 1000
            ),
          },
        });
      }
    });

    it('should run aggregation manually', async () => {
      await aggregator.runAggregation();
      // Should not throw
    });

    it('should start and stop aggregation job', () => {
      expect(() => {
        aggregator.start();
      }).not.toThrow();

      expect(() => {
        aggregator.stop();
      }).not.toThrow();
    });
  });
});
