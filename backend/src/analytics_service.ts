import { CACHE_TTL_SECONDS } from './lib/cache-config';
import { CacheKeyBuilder } from './lib/cache-key-builder';
import { logger } from './logger';
import * as redis from './redis';

import type { PrismaClient } from '@prisma/client';

/**
 * Narrow an open-ended Prisma JSON blob (e.g. a Soroban contract event `data`
 * payload) to a plain record. Returns an empty object for null/non-object
 * inputs so callers can safely read optional fields without extra guards.
 *
 * This is the canonical implementation shared by the analytics service,
 * aggregator, middleware and resync job.
 */
export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/**
 * Read a numeric field from an open-ended JSON blob, returning 0 when the
 * value is missing or not a finite number.
 */
export function readNumericField(value: unknown, ...keys: string[]): number {
  const record = asRecord(value);
  for (const key of keys) {
    const raw = record[key];
    if (raw === undefined || raw === null) continue;
    const num = Number(raw);
    if (!Number.isNaN(num) && Number.isFinite(num)) return num;
  }
  return 0;
}

/**
 * Read a string field from an open-ended JSON blob, returning undefined when
 * the value is missing or not a string.
 */
export function readStringField(value: unknown, ...keys: string[]): string | undefined {
  const record = asRecord(value);
  for (const key of keys) {
    const raw = record[key];
    if (typeof raw === 'string' && raw.length > 0) return raw;
  }
  return undefined;
}

/** Cache key for a group's daily stats snapshot. */
export function groupStatsCacheKey(groupId: string, dateStr: string): string {
  return `group_stats:${groupId}:${dateStr}`;
}

/** Cache key for platform trends over a date range. */
export function platformTrendsCacheKey(startDate: Date, endDate: Date): string {
  return `platform_trends:${startDate.getTime()}:${endDate.getTime()}`;
}

/** Cache key for aggregated event stats. */
export function eventStatsCacheKey(startDate?: Date): string {
  return `event_stats:${startDate?.getTime() || 'all'}`;
}

/** Cache key for the landing-page groups overview. */
export const GROUPS_OVERVIEW_CACHE_KEY = 'stats:groups:overview';

/** TTL (seconds) for the landing-page groups overview cache entry. */
export const GROUPS_OVERVIEW_CACHE_TTL_SECONDS = 300;

export interface GroupCycleStats {
  cycleNumber: number;
  cycleDate: Date;
  memberCount: number;
  totalContributions: number;
  totalContributionAmount: number;
  totalPayoutsDistributed: number;
  successRate: number;
  averageContributionSize: number;
  newMembersCount: number;
  churnCount: number;
}

export interface SorobanSyncOptions {
  contractId?: string;
  lookbackHours?: number;
  limit?: number;
}

export interface SorobanSyncResult {
  scanned: number;
  indexed: number;
  skipped: number;
}

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
  cycleStats?: GroupCycleStats[];
}

/**
 * Platform-wide group statistics for the landing page.
 * Aggregated from the ContractEvent indexed events database.
 */
export interface GroupsOverviewStats {
  totalGroups: number;
  totalContributed: number;
  activeMembers: number;
  cachedAt: string;
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
  data: Record<string, unknown>;
  generatedAt: Date;
}

export class AnalyticsService {
  private prisma: PrismaClient;
  private cacheClient = redis;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get platform-wide statistics
   */
  async getPlatformStats(date?: Date): Promise<PlatformStats | null> {
    const targetDate = date || new Date();
    const dateStr = targetDate.toISOString().split('T')[0];
    const cacheKey = CacheKeyBuilder.analyticsPlatformStats(dateStr);

    // Try to get from cache
    const cached = await this.cacheClient.get(cacheKey);
    if (cached) return cached as PlatformStats;

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
      await this.cacheClient.set(cacheKey, stats, CACHE_TTL_SECONDS.ANALYTICS_PLATFORM_STATS);
      return stats;
    } catch (error) {
      logger.error('Error fetching platform stats:', error);
      throw error;
    }
  }

  /**
   * Get user-specific statistics
   */
  async getUserStats(userId: string, date?: Date): Promise<UserStats | null> {
    const targetDate = date || new Date();
    const dateStr = targetDate.toISOString().split('T')[0];
    const cacheKey = CacheKeyBuilder.analyticsUserStats(userId, dateStr);

    // Try to get from cache
    const cached = await this.cacheClient.get(cacheKey);
    if (cached) return cached as UserStats;

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
      await this.cacheClient.set(cacheKey, stats, CACHE_TTL_SECONDS.ANALYTICS_USER_STATS);
      return stats;
    } catch (error) {
      logger.error('Error fetching user stats:', error);
      throw error;
    }
  }

  /**
   * Get group-specific statistics
   */
  async getGroupStats(groupId: string, date?: Date): Promise<GroupStats | null> {
    const targetDate = date || new Date();
    const dateStr = targetDate.toISOString().split('T')[0];
    const cacheKey = groupStatsCacheKey(groupId, dateStr);

    // Try to get from cache
    const cached = await this.cacheClient.get(cacheKey);
    if (cached) return cached as GroupStats;

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

      const cycleStats = await this.getGroupCycleStats(groupId);

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
        cycleStats,
      };

      // Cache the result
      await this.cacheClient.set(cacheKey, stats, CACHE_TTL_SECONDS.DEFAULT);
      return stats;
    } catch (error) {
      logger.error('Error fetching group stats:', error);
      throw error;
    }
  }

  /**
   * Get cycle-by-cycle stats for a group.
   */
  async getGroupCycleStats(
    groupId: string,
    options?: AnalyticsOptions
  ): Promise<GroupCycleStats[]> {
    try {
      const metrics = await this.prisma.groupMetrics.findMany({
        where: {
          groupId,
          ...(options?.startDate || options?.endDate
            ? {
                date: {
                  gte: options?.startDate,
                  lte: options?.endDate,
                },
              }
            : {}),
        },
        orderBy: { date: 'asc' },
        take: options?.limit,
        skip: options?.offset,
      });

      return metrics.map((metric, index: number) => ({
        cycleNumber: index + 1,
        cycleDate: metric.date,
        memberCount: metric.memberCount,
        totalContributions: metric.totalContributions,
        totalContributionAmount: Number(metric.totalContributionAmount),
        totalPayoutsDistributed: Number(metric.totalPayoutsDistributed),
        successRate: Number(metric.successRate),
        averageContributionSize: Number(metric.averageContributionSize),
        newMembersCount: metric.newMembersCount,
        churnCount: metric.churnCount,
      }));
    } catch (error) {
      logger.error('Error fetching group cycle stats:', error);
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
    const cacheKey = platformTrendsCacheKey(startDate, endDate);
    const cached = await this.cacheClient.get(cacheKey);
    if (cached) return cached as PlatformStats[];

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

      const trends: PlatformStats[] = metrics.map((m) => ({
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

      await this.cacheClient.set(cacheKey, trends, CACHE_TTL_SECONDS.DEFAULT);
      return trends;
    } catch (error) {
      logger.error('Error fetching platform trends:', error);
      throw error;
    }
  }

  /**
   * Get event statistics
   */
  async getEventStats(options?: AnalyticsOptions): Promise<EventStats[]> {
    const cacheKey = eventStatsCacheKey(options?.startDate);
    const cached = await this.cacheClient.get(cacheKey);
    if (cached) return cached as EventStats[];

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

      await this.cacheClient.set(cacheKey, eventStats, CACHE_TTL_SECONDS.DEFAULT);
      return eventStats;
    } catch (error) {
      logger.error('Error fetching event stats:', error);
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
    eventData?: Record<string, unknown>,
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
      logger.error('Error recording analytics event:', error);
      // Don't throw - analytics tracking should never break the app
    }
  }

  /**
   * Index raw Soroban contract events into AnalyticsEvent rows.
   *
   * This keeps analytics aggregation in sync when the contract indexer
   * discovers ContributionEvent and PayoutEvent data.
   */
  async syncSorobanEvents(options: SorobanSyncOptions = {}): Promise<SorobanSyncResult> {
    const lookbackHours = options.lookbackHours ?? 24;
    const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

    const events = await this.prisma.contractEvent.findMany({
      where: {
        ...(options.contractId ? { contractId: options.contractId } : {}),
        timestamp: { gte: since },
      },
      orderBy: { timestamp: 'asc' },
      take: options.limit,
    });

    let indexed = 0;
    let skipped = 0;

    for (const event of events) {
      const normalized = this.normalizeSorobanEvent(event);

      if (!normalized) {
        skipped++;
        continue;
      }

      const existing = await this.prisma.analyticsEvent.findFirst({
        where: { eventName: normalized.eventName },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await this.prisma.analyticsEvent.create({
        data: normalized,
      });

      indexed++;
    }

    return { scanned: events.length, indexed, skipped };
  }

  /**
   * Re-sync the latest Soroban events and refresh daily analytics.
   */
  async resyncSorobanAnalytics(options: SorobanSyncOptions = {}): Promise<SorobanSyncResult> {
    const syncResult = await this.syncSorobanEvents(options);

    const aggregator = new (await import('./analytics_aggregator')).AnalyticsAggregator(
      this.prisma
    );
    await aggregator.runAggregation();

    return syncResult;
  }

  private normalizeSorobanEvent(event: {
    id: string;
    contractId: string;
    eventType: string;
    topics: unknown;
    data: unknown;
    txHash: string;
    ledgerSeq: number;
    timestamp: Date;
  }): {
    eventType: string;
    eventName: string;
    userId?: string;
    groupId?: string;
    eventData?: Record<string, unknown>;
    sessionId?: string;
  } | null {
    const rawType = String(event.eventType || '').toLowerCase();
    const rawData = asRecord(event.data);
    const topicString = JSON.stringify(event.topics || []).toLowerCase();
    const payloadString = JSON.stringify(rawData).toLowerCase();
    const isContribution =
      rawType.includes('contribution') ||
      topicString.includes('contribution') ||
      payloadString.includes('contribution');
    const isPayout =
      rawType.includes('payout') ||
      topicString.includes('payout') ||
      payloadString.includes('payout');

    if (!isContribution && !isPayout) {
      return null;
    }

    const amount = readNumericField(
      rawData,
      'amount',
      'contribution_amount',
      'payout_amount'
    );
    const userId =
      readStringField(rawData, 'userId', 'memberId', 'member_address') ?? event.txHash;
    const groupId = readStringField(rawData, 'groupId', 'group_id') ?? event.contractId;

    return {
      eventType: 'transaction',
      eventName: `soroban_${isContribution ? 'contribution' : 'payout'}_${event.id}`,
      userId,
      groupId,
      sessionId: readStringField(rawData, 'sessionId'),
      eventData: {
        type: isContribution ? 'contribution' : 'payout',
        amount,
        ledgerSeq: event.ledgerSeq,
        txHash: event.txHash,
        contractEventId: event.id,
        contractId: event.contractId,
        rawEventType: event.eventType,
        ...rawData,
      },
    };
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
        platformMetrics: platformMetrics.map((m) => ({
          date: m.date,
          users: m.totalUsers,
          groups: m.totalGroups,
          contributions: m.totalContributions,
          successRate: Number(m.successRate),
        })),
        statistics: {
          avgUsers:
            platformMetrics.length > 0
              ? platformMetrics.reduce((sum: number, m) => sum + m.totalUsers, 0) /
                platformMetrics.length
              : 0,
          avgGroups:
            platformMetrics.length > 0
              ? platformMetrics.reduce((sum: number, m) => sum + m.totalGroups, 0) /
                platformMetrics.length
              : 0,
          totalContributions: platformMetrics.reduce(
            (sum: number, m) => sum + m.totalContributions,
            0
          ),
          totalRevenue: platformMetrics.reduce(
            (sum: number, m) => sum + Number(m.totalContributionAmount),
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
      logger.error('Error generating report:', error);
      throw error;
    }
  }

  /**
   * Get existing reports
   */
  async getReports(reportType?: string, options?: AnalyticsOptions): Promise<AnalyticsReport[]> {
    try {
      const reports = await this.prisma.analyticsReport.findMany({
        where: reportType ? { reportType } : undefined,
        orderBy: { createdAt: 'desc' },
        take: options?.limit,
        skip: options?.offset,
      });

      return reports.map((r) => ({
        reportType: r.reportType,
        reportName: r.reportName,
        startDate: r.startDate,
        endDate: r.endDate,
        data: r.data as Record<string, unknown>,
        generatedAt: r.createdAt,
      }));
    } catch (error) {
      logger.error('Error fetching reports:', error);
      throw error;
    }
  }

  /**
   * Get platform-wide group statistics for the landing page.
   * Aggregates from the ContractEvent indexed events database.
   * Results are cached in Redis with a 5-minute TTL.
   *
   * Event type conventions (emitted by the Stellar contract):
   *   - "group_created"      → each event = one new group
   *   - "contribution_made"  → event.data.amount = XLM contributed
   *   - "member_joined"      → unique member addresses = active members
   */
  async getGroupsOverviewStats(): Promise<GroupsOverviewStats> {
    // Return cached value if available
    const cached = await this.cacheClient.get(GROUPS_OVERVIEW_CACHE_KEY);
    if (cached) return cached as GroupsOverviewStats;

    try {
      // 1. Total groups — count distinct group_created events
      const totalGroups = await this.prisma.contractEvent.count({
        where: { eventType: 'group_created' },
      });

      // 2. Total contributed — sum the `amount` field from contribution_made events.
      //    Prisma doesn't support JSON field aggregation natively, so we pull the
      //    raw count and rely on the stored numeric data field via a raw query fallback.
      //    We use a safe aggregation: fetch all contribution amounts and sum in JS.
      //    For large datasets this should be replaced with a raw SQL SUM on the JSON field.
      const contributionEvents = await this.prisma.contractEvent.findMany({
        where: { eventType: 'contribution_made' },
        select: { data: true },
      });

      const totalContributed = contributionEvents.reduce(
        (sum: number, event: { data: unknown }) => sum + readNumericField(event.data, 'amount'),
        0
      );

      // 3. Active members — count unique member addresses from member_joined events.
      //    We group by the `data->>'memberAddress'` field. Since Prisma doesn't support
      //    JSON groupBy, we fetch distinct addresses via a raw query approach:
      //    pull all member_joined events and deduplicate in JS.
      const memberEvents = await this.prisma.contractEvent.findMany({
        where: { eventType: 'member_joined' },
        select: { data: true },
      });

      const uniqueAddresses = new Set<string>();
      for (const event of memberEvents) {
        const address = readStringField(event.data, 'memberAddress');
        if (address) {
          uniqueAddresses.add(address);
        }
      }
      const activeMembers = uniqueAddresses.size;

      const stats: GroupsOverviewStats = {
        totalGroups,
        totalContributed,
        activeMembers,
        cachedAt: new Date().toISOString(),
      };

      await this.cacheClient.set(
        GROUPS_OVERVIEW_CACHE_KEY,
        stats,
        GROUPS_OVERVIEW_CACHE_TTL_SECONDS
      );
      return stats;
    } catch (error) {
      logger.error('Error fetching groups overview stats:', error);
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
      logger.error('Error clearing cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    return await redis.getCacheStats();
  }
}
