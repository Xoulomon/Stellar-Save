import { prisma } from './prisma_client';
import { logger } from './logger';
import { config } from './config';

export interface FraudScore {
  entityType: 'account' | 'group';
  entityId: string;
  riskScore: number; // 0.0 – 1.0
  reasons: string[];
  evidence: Record<string, unknown>;
}

const HIGH_RISK_THRESHOLD = 0.7;

export class FraudDetectionService {
  private readonly sybilThreshold = config.fraud.sybilThreshold;
  private readonly rapidCycleHours = config.fraud.rapidCycleHours;
  private readonly outlierFactor = config.fraud.outlierFactor;

  async scoreAccount(address: string): Promise<FraudScore> {
    const windowMs = this.rapidCycleHours * 60 * 60 * 1000;
    const since = new Date(Date.now() - windowMs);

    const recentCreations = await (prisma as any).contractEvent.count({
      where: {
        eventType: 'GroupCreated',
        data: { path: ['creator'], equals: address },
        timestamp: { gte: since },
      },
    });

    const reasons: string[] = [];
    let score = 0;
    const evidence: Record<string, unknown> = { recentGroupCreations: recentCreations };

    if (recentCreations > this.sybilThreshold) {
      reasons.push(`Sybil pattern: ${recentCreations} groups created in ${this.rapidCycleHours}h`);
      score = Math.min(1, score + 0.5 + (recentCreations - this.sybilThreshold) * 0.1);
    }

    return { entityType: 'account', entityId: address, riskScore: score, reasons, evidence };
  }

  async scoreGroup(groupId: string): Promise<FraudScore> {
    const reasons: string[] = [];
    let score = 0;
    const evidence: Record<string, unknown> = {};

    // Rapid create/dissolve
    const created = await (prisma as any).contractEvent.findFirst({
      where: { eventType: 'GroupCreated', data: { path: ['group_id'], equals: groupId } },
      orderBy: { timestamp: 'asc' },
    });
    const completed = await (prisma as any).contractEvent.findFirst({
      where: { eventType: { in: ['GroupCompleted', 'GroupDissolved'] }, data: { path: ['group_id'], equals: groupId } },
      orderBy: { timestamp: 'asc' },
    });

    if (created && completed) {
      const diffHours = (new Date(completed.timestamp).getTime() - new Date(created.timestamp).getTime()) / 3600000;
      evidence.lifespanHours = diffHours;
      if (diffHours < this.rapidCycleHours) {
        reasons.push(`Rapid cycle: group completed in ${diffHours.toFixed(1)}h`);
        score = Math.min(1, score + 0.4);
      }
    }

    // Abnormal contribution amounts
    const contributions = await (prisma as any).contractEvent.findMany({
      where: { eventType: 'ContributionMade', data: { path: ['group_id'], equals: groupId } },
      select: { data: true },
    });

    if (contributions.length > 1) {
      const amounts = contributions
        .map((c: any) => Number(c.data?.amount ?? 0))
        .filter((a: number) => a > 0);
      const avg = amounts.reduce((s: number, a: number) => s + a, 0) / amounts.length;
      const outliers = amounts.filter((a: number) => a > avg * this.outlierFactor);
      evidence.avgContribution = avg;
      evidence.outlierCount = outliers.length;
      if (outliers.length > 0) {
        reasons.push(`${outliers.length} contribution(s) > ${this.outlierFactor}x average`);
        score = Math.min(1, score + 0.3);
      }
    }

    return { entityType: 'group', entityId: groupId, riskScore: score, reasons, evidence };
  }

  async runScan(): Promise<FraudScore[]> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentEvents = await (prisma as any).contractEvent.findMany({
      where: { timestamp: { gte: since } },
      select: { eventType: true, data: true },
    });

    const accounts = new Set<string>();
    const groups = new Set<string>();

    for (const ev of recentEvents) {
      const data = ev.data as Record<string, unknown>;
      if (data?.creator) accounts.add(String(data.creator));
      if (data?.group_id) groups.add(String(data.group_id));
    }

    const scores: FraudScore[] = [];

    for (const address of accounts) {
      const s = await this.scoreAccount(address);
      if (s.riskScore >= HIGH_RISK_THRESHOLD) {
        await this.persistFlag(s);
        scores.push(s);
      }
    }

    for (const groupId of groups) {
      const s = await this.scoreGroup(groupId);
      if (s.riskScore >= HIGH_RISK_THRESHOLD) {
        await this.persistFlag(s);
        scores.push(s);
      }
    }

    logger.info('Fraud scan complete', { flagged: scores.length, accounts: accounts.size, groups: groups.size });
    return scores;
  }

  private async persistFlag(score: FraudScore): Promise<void> {
    await (prisma as any).fraudFlag.upsert({
      where: {
        // use a composite-like lookup — store as single entityType+entityId lookup via findFirst
        id: `${score.entityType}:${score.entityId}:pending`,
      },
      update: {
        riskScore: score.riskScore,
        reasons: score.reasons,
        evidence: score.evidence,
        updatedAt: new Date(),
      },
      create: {
        id: `${score.entityType}:${score.entityId}:pending`,
        entityType: score.entityType,
        entityId: score.entityId,
        riskScore: score.riskScore,
        reasons: score.reasons,
        evidence: score.evidence,
      },
    }).catch(async () => {
      // If id collision, just create a new flag
      await (prisma as any).fraudFlag.create({
        data: {
          entityType: score.entityType,
          entityId: score.entityId,
          riskScore: score.riskScore,
          reasons: score.reasons,
          evidence: score.evidence,
        },
      });
    });
  }

  async getFlags(status?: string): Promise<unknown[]> {
    return (prisma as any).fraudFlag.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewFlag(id: string, status: string, reviewedBy: string): Promise<unknown> {
    return (prisma as any).fraudFlag.update({
      where: { id },
      data: { status, reviewedBy, reviewedAt: new Date() },
    });
  }
}

export const fraudDetectionService = new FraudDetectionService();
