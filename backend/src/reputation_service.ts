/**
 * Member reputation scoring service (#800)
 *
 * Score = onTimeContributions / totalContributions (0.0 – 1.0)
 * Updated incrementally as contribution events are indexed.
 */

let _prisma: any = null;
function getPrisma(): any {
  if (!_prisma) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PrismaClient } = require('./generated/prisma/client');
      _prisma = new PrismaClient();
    } catch {
      // Prisma client not generated yet
    }
  }
  return _prisma;
}

export interface ReputationRecord {
  address: string;
  score: number;           // 0.0 – 1.0
  totalContributions: number;
  onTimeContributions: number;
  updatedAt: string;
}

/**
 * Get the reputation record for a member address.
 * Returns a default record (score 0, no history) if not found.
 */
export async function getMemberReputation(address: string): Promise<ReputationRecord> {
  const prisma = getPrisma();
  if (!prisma) {
    return { address, score: 0, totalContributions: 0, onTimeContributions: 0, updatedAt: new Date().toISOString() };
  }

  const record = await prisma.memberReputation.findUnique({ where: { address } });
  if (!record) {
    return { address, score: 0, totalContributions: 0, onTimeContributions: 0, updatedAt: new Date().toISOString() };
  }

  return {
    address: record.address,
    score: record.score,
    totalContributions: record.totalContributions,
    onTimeContributions: record.onTimeContributions,
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * Incrementally update a member's reputation after a contribution event.
 * @param address  Member wallet address
 * @param onTime   Whether the contribution was on time
 */
export async function recordContribution(address: string, onTime: boolean): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;

  const existing = await prisma.memberReputation.findUnique({ where: { address } });

  const totalContributions = (existing?.totalContributions ?? 0) + 1;
  const onTimeContributions = (existing?.onTimeContributions ?? 0) + (onTime ? 1 : 0);
  const score = totalContributions > 0 ? onTimeContributions / totalContributions : 0;

  await prisma.memberReputation.upsert({
    where: { address },
    create: { address, totalContributions, onTimeContributions, score },
    update: { totalContributions, onTimeContributions, score },
  });
}

/**
 * Recalculate score from scratch based on stored totals.
 * Useful for batch recalculation.
 */
export function calculateScore(totalContributions: number, onTimeContributions: number): number {
  if (totalContributions === 0) return 0;
  return Math.min(1, Math.max(0, onTimeContributions / totalContributions));
}
