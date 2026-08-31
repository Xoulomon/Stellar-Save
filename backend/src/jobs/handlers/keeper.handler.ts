import { Counter, Registry } from 'prom-client';
import { logger } from '../../logger';
import { registry } from '../../metrics';
import { prisma } from '../../prisma_client';
import { IStellarClient } from '../../lib/stellar_client';

const MAX_RETRIES = 3;

const keeperPayoutsExecuted = new Counter({
  name: 'keeper_payouts_executed_total',
  help: 'Total group payouts executed by the keeper',
  labelNames: ['status'],
  registers: [registry as Registry],
});

const keeperPayoutFailures = new Counter({
  name: 'keeper_payout_failures_total',
  help: 'Total keeper payout failures (dead-lettered after max retries)',
  registers: [registry as Registry],
});

interface DueGroup {
  groupId: string;
  cycleNumber: number;
  memberCount: number;
}

async function findDueGroups(contractId: string, db: any = prisma): Promise<DueGroup[]> {
  const contributions: Array<{ data: any }> = await db.contractEvent.findMany({
    where: { contractId, eventType: 'ContributionMade' },
    select: { data: true },
  });

  const cycleMap = new Map<string, Set<string>>();
  for (const { data } of contributions) {
    const groupId: string = data?.group_id ?? data?.groupId;
    const cycleNumber: string | number = data?.cycle_number ?? data?.cycleNumber ?? '0';
    const member: string = data?.member ?? data?.address ?? 'unknown';
    if (!groupId) continue;
    const key = `${groupId}:${cycleNumber}`;
    if (!cycleMap.has(key)) cycleMap.set(key, new Set());
    cycleMap.get(key)!.add(member);
  }

  const payouts: Array<{ data: any }> = await db.contractEvent.findMany({
    where: { contractId, eventType: 'PayoutExecuted' },
    select: { data: true },
  });
  const paidKeys = new Set<string>();
  for (const { data } of payouts) {
    const gid: string = data?.group_id ?? data?.groupId;
    const cycle: string | number = data?.cycle_number ?? data?.cycleNumber ?? '0';
    if (gid) paidKeys.add(`${gid}:${cycle}`);
  }

  const due: DueGroup[] = [];
  for (const [key, members] of cycleMap.entries()) {
    if (paidKeys.has(key)) continue;
    const [groupId, cycleStr] = key.split(':');
    if (members.size >= 2) {
      due.push({ groupId, cycleNumber: parseInt(cycleStr, 10), memberCount: members.size });
    }
  }

  return due;
}

export class KeeperHandler {
  private contractId: string;
  private stellarClient: IStellarClient;
  private db: any;
  private retryMap = new Map<string, number>();

  constructor(contractId: string, stellarClient: IStellarClient, dbClient?: any) {
    this.contractId = contractId;
    this.stellarClient = stellarClient;
    this.db = dbClient ?? prisma;
  }

  async execute(): Promise<void> {
    const due = await findDueGroups(this.contractId, this.db);
    if (due.length === 0) {
      logger.debug('[keeper] no groups due for payout');
      return;
    }

    const actionable = due.filter(g => (this.retryMap.get(`${g.groupId}:${g.cycleNumber}`) ?? 0) < MAX_RETRIES);

    if (actionable.length === 0) {
      logger.warn('[keeper] all due groups are dead-lettered');
      return;
    }

    const groupIds = actionable.map(g => g.groupId);
    logger.info('[keeper] executing payouts batch', { groupIds });

    try {
      await this.stellarClient.executePayoutsBatch(groupIds, this.contractId);
      keeperPayoutsExecuted.inc({ status: 'success' }, groupIds.length);
      for (const g of actionable) this.retryMap.delete(`${g.groupId}:${g.cycleNumber}`);
    } catch (err: any) {
      logger.error('[keeper] batch execution failed', { error: err?.message, groupIds });
      keeperPayoutsExecuted.inc({ status: 'failure' }, groupIds.length);

      for (const g of actionable) {
        const key = `${g.groupId}:${g.cycleNumber}`;
        const retries = (this.retryMap.get(key) ?? 0) + 1;
        this.retryMap.set(key, retries);
        if (retries >= MAX_RETRIES) {
          keeperPayoutFailures.inc();
          logger.error('[keeper] group dead-lettered after max retries', {
            groupId: g.groupId,
            cycleNumber: g.cycleNumber,
            retries,
          });
        }
      }
    }
  }
}
