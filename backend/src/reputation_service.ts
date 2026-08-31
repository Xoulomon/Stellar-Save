/**
 * Member reputation scoring service (#800)
 *
 * Score = onTimeContributions / totalContributions (0.0 – 1.0)
 * Updated incrementally as contribution events are indexed.
 */

import { logger } from './logger';
import { memberReputationRepository } from './modules/reputation/reputation.repository';

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
  const emptyRecord = (): ReputationRecord => ({
    address,
    score: 0,
    totalContributions: 0,
    onTimeContributions: 0,
    updatedAt: new Date().toISOString(),
  });

  let record;
  try {
    record = await memberReputationRepository.findByAddress(address);
  } catch (error) {
    // Reputation is a display-time signal — degrade to a neutral record rather
    // than failing the caller if the store is unreachable.
    logger.warn('reputation lookup failed; returning default', { address, error: String(error) });
    return emptyRecord();
  }

  if (!record) {
    return emptyRecord();
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
  const existing = await memberReputationRepository.findByAddress(address);

  const totalContributions = (existing?.totalContributions ?? 0) + 1;
  const onTimeContributions = (existing?.onTimeContributions ?? 0) + (onTime ? 1 : 0);
  const score = totalContributions > 0 ? onTimeContributions / totalContributions : 0;

  await memberReputationRepository.upsertTotals(address, {
    totalContributions,
    onTimeContributions,
    score,
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
