import { PrismaClient } from '@prisma/client';
import * as redis from './redis';

export class AnalyticsAggregator {
  private prisma: PrismaClient;
  private aggregationInterval: NodeJS.Timer | null = null;
  private aggregationIntervalMs = 24 * 60 * 60 * 1000; // 24 hours by default

  constructor(prisma: PrismaClient, intervalMs?: number) {
    this.prisma = prisma;
    if (intervalMs) {
      this.aggregationIntervalMs = intervalMs;
    }
  }

  /**
   * Start the aggregation job (runs periodically)
   */
  start(): void {
    if (this.aggregationInterval) {
      console.warn('Aggregation job already running');
      return;
    }

    // Run immediately on start
    this.runAggregation();

    // Then run on interval
    this.aggregationInterval = setInterval(() => {
      this.runAggregation();
    }, this.aggregationIntervalMs);

    console.log(
      `Analytics aggregation job started (interval: ${this.aggregationIntervalMs}ms)`
    );
  }

  /**
   * Stop the aggregation job
   */
  stop(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.aggregationInterval = null;
      console.log('Analytics aggregation job stopped');
    }
  }

  /**
   * Run aggregation manually
   */
  async runAggregation(): Promise<void> {
    try {
      console.log('Starting analytics aggregation...');

      const startTime = Date.now();

      // Aggregate for yesterday (in case today isn't complete)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      await this.aggregatePlatformMetrics(yesterday);
      await this.aggregateUserMetrics(yesterday);
      await this.aggregateGroupMetrics(yesterday);

      const duration = Date.now() - startTime;
      console.log(`Analytics aggregation completed in ${duration}ms`);

      // Clear related caches
      await redis.delPattern('platform_stats:*');
      await redis.delPattern('platform_trends:*');
      await redis.delPattern('user_stats:*');
      await redis.delPattern('group_stats:*');
    } catch (error) {
      console.error('Error running analytics aggregation:', error);
    }
  }

  /**
   * Aggregate platform-wide metrics
   */
  private async aggregatePlatformMetrics(date: Date): Promise<void> {
    try {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      // Get events for the day
      const events = await this.prisma.analyticsEvent.findMany({
        where: {
          createdAt: {
            gte: date,
            lt: nextDay,
          },
        },
      });

      // Count unique users and groups
      const uniqueUsers = new Set(events.map((e) => e.userId).filter(Boolean));
      const uniqueGroups = new Set(events.map((e) => e.groupId).filter(Boolean));

      // Count events by type
      const contributions = events.filter(
        (e) => e.eventType === 'transaction' && (e.eventData as any)?.type === 'contribution'
      ).length;
      const payouts = events.filter(
        (e) => e.eventType === 'transaction' && (e.eventData as any)?.type === 'payout'
      ).length;

      // Calculate totals from transactions
      const contributionTotal = events
        .filter(
          (e) => e.eventType === 'transaction' && (e.eventData as any)?.type === 'contribution'
        )
        .reduce((sum, e) => sum + ((e.eventData as any)?.amount || 0), 0);

      const payoutTotal = events
        .filter((e) => e.eventType === 'transaction' && (e.eventData as any)?.type === 'payout')
        .reduce((sum, e) => sum + ((e.eventData as any)?.amount || 0), 0);

      // Calculate success rate (groups that completed payouts)
      const completedGroups = events.filter(
        (e) => e.eventType === 'group_completed'
      ).length;
      const createdGroups = events.filter(
        (e) => e.eventType === 'group_created'
      ).length;
      const successRate =
        createdGroups > 0 ? (completedGroups / createdGroups) * 100 : 0;

      // Check if metrics already exist for this date
      const existingMetrics = await this.prisma.platformMetrics.findFirst({
        where: {
          date: {
            gte: date,
            lt: nextDay,
          },
        },
      });

      // Upsert metrics
      if (existingMetrics) {
        await this.prisma.platformMetrics.update({
          where: { id: existingMetrics.id },
          data: {
            totalUsers: uniqueUsers.size,
            activeUsers: events.filter((e) => e.eventType === 'page_view').length > 0 ? uniqueUsers.size : 0,
            totalGroups: uniqueGroups.size,
            activeGroups: events.filter((e) => e.eventType === 'group_activity').length > 0
              ? uniqueGroups.size
              : 0,
            totalContributions: contributions,
            totalContributionAmount: contributionTotal,
            totalPayouts: payouts,
            totalPayoutAmount: payoutTotal,
            averageGroupSize:
              uniqueGroups.size > 0
                ? uniqueUsers.size / uniqueGroups.size
                : 0,
            successRate,
            totalTransactions: contributions + payouts,
            uniqueWallets: uniqueUsers.size,
            updatedAt: new Date(),
          },
        });
      } else {
        await this.prisma.platformMetrics.create({
          data: {
            date,
            totalUsers: uniqueUsers.size,
            activeUsers: events.filter((e) => e.eventType === 'page_view').length > 0 ? uniqueUsers.size : 0,
            totalGroups: uniqueGroups.size,
            activeGroups: events.filter((e) => e.eventType === 'group_activity').length > 0
              ? uniqueGroups.size
              : 0,
            totalContributions: contributions,
            totalContributionAmount: contributionTotal,
            totalPayouts: payouts,
            totalPayoutAmount: payoutTotal,
            averageGroupSize:
              uniqueGroups.size > 0
                ? uniqueUsers.size / uniqueGroups.size
                : 0,
            successRate,
            totalTransactions: contributions + payouts,
            uniqueWallets: uniqueUsers.size,
          },
        });
      }

      console.log(`Platform metrics aggregated for ${date.toISOString().split('T')[0]}`);
    } catch (error) {
      console.error('Error aggregating platform metrics:', error);
    }
  }

  /**
   * Aggregate user-specific metrics
   */
  private async aggregateUserMetrics(date: Date): Promise<void> {
    try {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      // Get all events for the day
      const events = await this.prisma.analyticsEvent.findMany({
        where: {
          userId: { not: null },
          createdAt: {
            gte: date,
            lt: nextDay,
          },
        },
      });

      // Group events by userId
      const userEvents = new Map<string, any[]>();
      events.forEach((event) => {
        if (event.userId) {
          if (!userEvents.has(event.userId)) {
            userEvents.set(event.userId, []);
          }
          userEvents.get(event.userId)!.push(event);
        }
      });

      // Aggregate for each user
      for (const [userId, userEventList] of userEvents.entries()) {
        const groupsJoined = userEventList.filter((e) => e.eventType === 'join_group').length;
        const groupsCreated = userEventList.filter((e) => e.eventType === 'group_created').length;
        const groupsCompleted = userEventList.filter(
          (e) => e.eventType === 'group_completed'
        ).length;
        const contributions = userEventList.filter(
          (e) => e.eventType === 'transaction' && (e.eventData as any)?.type === 'contribution'
        ).length;
        const contributionAmount = userEventList
          .filter(
            (e) =>
              e.eventType === 'transaction' && (e.eventData as any)?.type === 'contribution'
          )
          .reduce((sum, e) => sum + ((e.eventData as any)?.amount || 0), 0);

        const payoutsReceived = userEventList
          .filter(
            (e) => e.eventType === 'transaction' && (e.eventData as any)?.type === 'payout'
          )
          .reduce((sum, e) => sum + ((e.eventData as any)?.amount || 0), 0);

        const sessions = new Set(userEventList.map((e) => e.sessionId).filter(Boolean))
          .size;
        const pageViews = userEventList.filter((e) => e.eventType === 'page_view').length;
        const interactions = userEventList.length;

        // Upsert user metrics
        const existingMetrics = await this.prisma.userMetrics.findFirst({
          where: {
            userId,
            date: {
              gte: date,
              lt: nextDay,
            },
          },
        });

        if (existingMetrics) {
          await this.prisma.userMetrics.update({
            where: { id: existingMetrics.id },
            data: {
              groupsJoined,
              groupsCreated,
              groupsCompleted,
              totalContributions: contributions,
              totalContributionAmount: contributionAmount,
              totalPayoutsReceived: payoutsReceived,
              sessionsCount: sessions,
              pageViews,
              interactionCount: interactions,
              updatedAt: new Date(),
            },
          });
        } else {
          await this.prisma.userMetrics.create({
            data: {
              userId,
              date,
              groupsJoined,
              groupsCreated,
              groupsCompleted,
              totalContributions: contributions,
              totalContributionAmount: contributionAmount,
              totalPayoutsReceived: payoutsReceived,
              sessionsCount: sessions,
              pageViews,
              interactionCount: interactions,
            },
          });
        }
      }

      console.log(`User metrics aggregated for ${userEvents.size} users on ${date.toISOString().split('T')[0]}`);
    } catch (error) {
      console.error('Error aggregating user metrics:', error);
    }
  }

  /**
   * Aggregate group-specific metrics
   */
  private async aggregateGroupMetrics(date: Date): Promise<void> {
    try {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      // Get all events for the day
      const events = await this.prisma.analyticsEvent.findMany({
        where: {
          groupId: { not: null },
          createdAt: {
            gte: date,
            lt: nextDay,
          },
        },
      });

      // Group events by groupId
      const groupEvents = new Map<string, any[]>();
      events.forEach((event) => {
        if (event.groupId) {
          if (!groupEvents.has(event.groupId)) {
            groupEvents.set(event.groupId, []);
          }
          groupEvents.get(event.groupId)!.push(event);
        }
      });

      // Aggregate for each group
      for (const [groupId, groupEventList] of groupEvents.entries()) {
        const members = new Set(groupEventList.map((e) => e.userId).filter(Boolean)).size;
        const contributions = groupEventList.filter(
          (e) => e.eventType === 'transaction' && (e.eventData as any)?.type === 'contribution'
        ).length;
        const contributionAmount = groupEventList
          .filter(
            (e) =>
              e.eventType === 'transaction' && (e.eventData as any)?.type === 'contribution'
          )
          .reduce((sum, e) => sum + ((e.eventData as any)?.amount || 0), 0);

        const payoutsDistributed = groupEventList
          .filter((e) => e.eventType === 'transaction' && (e.eventData as any)?.type === 'payout')
          .reduce((sum, e) => sum + ((e.eventData as any)?.amount || 0), 0);

        const completed = groupEventList.filter(
          (e) => e.eventType === 'group_completed'
        ).length;

        const successRate = completed > 0 ? 100 : 0;
        const avgContribution =
          contributions > 0 ? contributionAmount / contributions : 0;
        const newMembers = groupEventList.filter(
          (e) => e.eventType === 'member_joined'
        ).length;
        const churn = groupEventList.filter(
          (e) => e.eventType === 'member_left'
        ).length;

        // Upsert group metrics
        const existingMetrics = await this.prisma.groupMetrics.findFirst({
          where: {
            groupId,
            date: {
              gte: date,
              lt: nextDay,
            },
          },
        });

        if (existingMetrics) {
          await this.prisma.groupMetrics.update({
            where: { id: existingMetrics.id },
            data: {
              memberCount: members,
              totalContributions: contributions,
              totalContributionAmount: contributionAmount,
              totalPayoutsDistributed: payoutsDistributed,
              successRate,
              averageContributionSize: avgContribution,
              newMembersCount: newMembers,
              churnCount: churn,
              updatedAt: new Date(),
            },
          });
        } else {
          await this.prisma.groupMetrics.create({
            data: {
              groupId,
              date,
              memberCount: members,
              totalContributions: contributions,
              totalContributionAmount: contributionAmount,
              totalPayoutsDistributed: payoutsDistributed,
              successRate,
              averageContributionSize: avgContribution,
              newMembersCount: newMembers,
              churnCount: churn,
            },
          });
        }
      }

      console.log(`Group metrics aggregated for ${groupEvents.size} groups on ${date.toISOString().split('T')[0]}`);
    } catch (error) {
      console.error('Error aggregating group metrics:', error);
    }
  }
}
