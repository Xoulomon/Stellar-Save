import * as redis from './redis';
//import type { PrismaClient } from '@prisma/client';

export interface AnalyticsOptions {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface PlatformStats {
  totalUsers: number;
  activeUsers: number;
  totalGroups: number;
  activeGroups: number;
  totalContributions: number;
  totalContributionAmount: number;
  totalPayouts: number;
  totalPayoutAmount: number;
  averageGroupSize: number;
  successRate: number;
  totalTransactions: number;
  uniqueWallets: number;
}

export interface UserStats {
  userId: string;
  groupsJoined: number;
  groupsCreated: number;
  groupsCompleted: number;
  totalContributions: number;
  totalContributionAmount: number;
  totalPayoutsReceived: number;
  sessionsCount: number;
  sessionDurationMinutes: number;
  pageViews: number;
  interactionCount: number;
}

export interface GroupStats {
  groupId: string;
  memberCount: number;
  totalContributions: number;
  totalContributionAmount: number;
  totalPayoutsDistributed: number;
  successRate: number;
  averageContributionSize: number;
  newMembersCount: number;
  churnCount: number;
}

export interface EventStats {
  eventType: string;
  eventName: string;
  count: number;
  lastOccurred: Date;
}

export interface AnalyticsReport {
  reportType: string;
  reportName: string;
  startDate: Date;
  endDate: Date;
  data: Record<string, any>;
  generatedAt: Date;
}

export class AnalyticsService {
  private prisma: any;
  private cacheClient = redis;
  private cacheTTL = 3600; // 1 hour default

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Get platform-wide statistics
   */
  async getPlatformStats(date?: Date): Promise<PlatformStats | null> {
    const targetDate = date || new Date();
    const cacheKey = `platform_stats:${targetDate.toISOString().split('T')[0]}`;

    // Try to get from cache
    const cached = await this.cacheClient.get(cacheKey);
    if (cached) return cached;

    try {
      // Set and return default if no metrics found for this date
      const metrics = await this.prisma.platformMetrics.findFirst({
        where: {
          date: {
            gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()),
            lt: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1),
          },
        },
      });

      if (!metrics) return null;

      const stats: PlatformStats = {
        totalUsers: metrics.totalUsers,
        activeUsers: metrics.activeUsers,
        totalGroups: metrics.totalGroups,
        activeGroups: metrics.activeGroups,
        totalContributions: metrics.totalContributions,
        totalContributionAmount: Number(metrics.totalContributionAmount),
        totalPayouts: metrics.totalPayouts,
        totalPayoutAmount: Number(metrics.totalPayoutAmount),
        averageGroupSize: Number(metrics.averageGroupSize),
        successRate: Number(metrics.successRate),
        totalTransactions: metrics.totalTransactions,
        uniqueWallets: metrics.uniqueWallets,
      };

      // Cache the result
      await this.cacheClient.set(cacheKey, stats, this.cacheTTL);
      return stats;
    } catch (error) {
      console.error('Error fetching platform stats:', error);
      throw error;
    }
  }

  /**
   * Get user-specific statistics
   */
  async getUserStats(userId: string, date?: Date): Promise<UserStats | null> {
    const targetDate = date || new Date();
    const cacheKey = `user_stats:${userId}:${targetDate.toISOString().split('T')[0]}`;

    // Try to get from cache
    const cached = await this.cacheClient.get(cacheKey);
    if (cached) return cached;

    try {
      const metrics = await this.prisma.userMetrics.findFirst({
        where: {
          userId,
          date: {
            gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()),
            lt: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1),
          },
        },
      });

      if (!metrics) return null;

      const stats: UserStats = {
        userId,
        groupsJoined: metrics.groupsJoined,
        groupsCreated: metrics.groupsCreated,
        groupsCompleted: metrics.groupsCompleted,
        totalContributions: metrics.totalContributions,
        totalContributionAmount: Number(metrics.totalContributionAmount),
        totalPayoutsReceived: Number(metrics.totalPayoutsReceived),
        sessionsCount: metrics.sessionsCount,
        sessionDurationMinutes: metrics.sessionDurationMinutes,
        pageViews: metrics.pageViews,
        interactionCount: metrics.interactionCount,
      };

      // Cache the result
      await this.cacheClient.set(cacheKey, stats, this.cacheTTL);
      return stats;
    } catch (error) {
      console.error('Error fetching user stats:', error);
      throw error;
    }
  }

  /**
   * Get group-specific statistics
   */
  async getGroupStats(groupId: string, date?: Date): Promise<GroupStats | null> {
    const targetDate = date || new Date();
    const cacheKey = `group_stats:${groupId}:${targetDate.toISOString().split('T')[0]}`;

    // Try to get from cache
    const cached = await this.cacheClient.get(cacheKey);
    if (cached) return cached;

    try {
      const metrics = await this.prisma.groupMetrics.findFirst({
        where: {
          groupId,
          date: {
            gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()),
            lt: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1),
          },
        },
      });

      if (!metrics) return null;

      const stats: GroupStats = {
        groupId,
        memberCount: metrics.memberCount,
        totalContributions: metrics.totalContributions,
        totalContributionAmount: Number(metrics.totalContributionAmount),
        totalPayoutsDistributed: Number(metrics.totalPayoutsDistributed),
        successRate: Number(metrics.successRate),
        averageContributionSize: Number(metrics.averageContributionSize),
        newMembersCount: metrics.newMembersCount,
        churnCount: metrics.churnCount,
      };

      // Cache the result
      await this.cacheClient.set(cacheKey, stats, this.cacheTTL);
      return stats;
    } catch (error) {
      console.error('Error fetching group stats:', error);
      throw error;
    }
  }

  /**
   * Get analytics trends over a date range
   */
  async getPlatformTrends(
    startDate: Date,
    endDate: Date,
    options?: AnalyticsOptions
  ): Promise<PlatformStats[]> {
    const cacheKey = `platform_trends:${startDate.getTime()}:${endDate.getTime()}`;
    const cached = await this.cacheClient.get(cacheKey);
    if (cached) return cached;

    try {
      const metrics = await this.prisma.platformMetrics.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { date: 'asc' },
        take: options?.limit,
        skip: options?.offset,
      });

      const trends: PlatformStats[] = metrics.map((m: any) => ({
        totalUsers: m.totalUsers,
        activeUsers: m.activeUsers,
        totalGroups: m.totalGroups,
        activeGroups: m.activeGroups,
        totalContributions: m.totalContributions,
        totalContributionAmount: Number(m.totalContributionAmount),
        totalPayouts: m.totalPayouts,
        totalPayoutAmount: Number(m.totalPayoutAmount),
        averageGroupSize: Number(m.averageGroupSize),
        successRate: Number(m.successRate),
        totalTransactions: m.totalTransactions,
        uniqueWallets: m.uniqueWallets,
      }));

      await this.cacheClient.set(cacheKey, trends, this.cacheTTL);
      return trends;
    } catch (error) {
      console.error('Error fetching platform trends:', error);
      throw error;
    }
  }

  /**
   * Get event statistics
   */
  async getEventStats(options?: AnalyticsOptions): Promise<EventStats[]> {
    const cacheKey = `event_stats:${options?.startDate?.getTime() || 'all'}`;
    const cached = await this.cacheClient.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.prisma.analyticsEvent.groupBy({
        by: ['eventType', 'eventName'],
        _count: true,
        where: options?.startDate
          ? {
              createdAt: {
                gte: options.startDate,
                lte: options.endDate || new Date(),
              },
            }
          : undefined,
        orderBy: { _count: 'desc' },
        take: options?.limit,
        skip: options?.offset,
      });

      // Get last occurrence for each event
      const eventStats: EventStats[] = [];

      for (const group of result) {
        const lastEvent = await this.prisma.analyticsEvent.findFirst({
          where: {
            eventType: group.eventType,
            eventName: group.eventName,
          },
          orderBy: { createdAt: 'desc' },
        });

        eventStats.push({
          eventType: group.eventType,
          eventName: group.eventName,
          count: group._count,
          lastOccurred: lastEvent?.createdAt || new Date(),
        });
      }

      await this.cacheClient.set(cacheKey, eventStats, this.cacheTTL);
      return eventStats;
    } catch (error) {
      console.error('Error fetching event stats:', error);
      throw error;
    }
  }

  /**
   * Record an analytics event
   */
  async recordEvent(
    eventType: string,
    eventName: string,
    userId?: string,
    groupId?: string,
    eventData?: Record<string, any>,
    sessionId?: string
  ): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          eventType,
          eventName,
          userId,
          groupId,
          eventData,
          sessionId,
        },
      });

      // Invalidate event stats cache
      await redis.delPattern('event_stats:*');
    } catch (error) {
      console.error('Error recording analytics event:', error);
      // Don't throw - analytics tracking should never break the app
    }
  }

  /**
   * Generate a custom analytics report
   */
  async generateReport(
    reportType: string,
    reportName: string,
    startDate: Date,
    endDate: Date,
    generatedBy?: string
  ): Promise<AnalyticsReport> {
    try {
      // Collect data for report
      const platformMetrics = await this.prisma.platformMetrics.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      const eventStats = await this.getEventStats({ startDate, endDate });

      const reportData = {
        summary: {
          startDate,
          endDate,
          metricsCount: platformMetrics.length,
          topEvents: eventStats.slice(0, 10),
        },
        platformMetrics: platformMetrics.map((m: any) => ({
          date: m.date,
          users: m.totalUsers,
          groups: m.totalGroups,
          contributions: m.totalContributions,
          successRate: Number(m.successRate),
        })),
        statistics: {
          avgUsers:
            platformMetrics.length > 0
              ? platformMetrics.reduce((sum: number, m: any) => sum + m.totalUsers, 0) /
                platformMetrics.length
              : 0,
          avgGroups:
            platformMetrics.length > 0
              ? platformMetrics.reduce((sum: number, m: any) => sum + m.totalGroups, 0) /
                platformMetrics.length
              : 0,
          totalContributions: platformMetrics.reduce((sum: number, m: any) => sum + m.totalContributions, 0),
          totalRevenue: platformMetrics.reduce(
            (sum: number, m: any) => sum + Number(m.totalContributionAmount),
            0
          ),
        },
      };

      // Save report to database
      const report = await this.prisma.analyticsReport.create({
        data: {
          reportType,
          reportName,
          startDate,
          endDate,
          data: reportData,
          generatedBy,
          status: 'completed',
        },
      });

      return {
        reportType,
        reportName,
        startDate,
        endDate,
        data: reportData,
        generatedAt: report.createdAt,
      };
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  }

  /**
   * Get existing reports
   */
  async getReports(
    reportType?: string,
    options?: AnalyticsOptions
  ): Promise<AnalyticsReport[]> {
    try {
      const reports = await this.prisma.analyticsReport.findMany({
        where: reportType ? { reportType } : undefined,
        orderBy: { createdAt: 'desc' },
        take: options?.limit,
        skip: options?.offset,
      });

      return reports.map((r: any) => ({
        reportType: r.reportType,
        reportName: r.reportName,
        startDate: r.startDate,
        endDate: r.endDate,
        data: r.data as Record<string, any>,
        generatedAt: r.createdAt,
      }));
    } catch (error) {
      console.error('Error fetching reports:', error);
      throw error;
    }
  }

  /**
   * Clear specific cache entries
   */
  async clearCache(pattern: string): Promise<void> {
    try {
      await redis.delPattern(pattern);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    return await redis.getCacheStats();
  }
}
