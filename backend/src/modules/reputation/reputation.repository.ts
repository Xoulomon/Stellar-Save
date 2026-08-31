/**
 * MemberReputation repository (#41).
 *
 * Single owner of all `prisma.memberReputation.*` access. Services must go
 * through this class instead of touching Prisma directly so query logic stays
 * in one place and can be unit-tested with a mocked client.
 */
export interface MemberReputationRow {
  address: string;
  score: number;
  totalContributions: number;
  onTimeContributions: number;
  updatedAt: Date;
}

export interface MemberReputationTotals {
  totalContributions: number;
  onTimeContributions: number;
  score: number;
}

/** Minimal structural view of the Prisma delegate this repository needs. */
export interface MemberReputationDelegate {
  findUnique(args: { where: { address: string } }): Promise<MemberReputationRow | null>;
  upsert(args: {
    where: { address: string };
    create: { address: string } & MemberReputationTotals;
    update: MemberReputationTotals;
  }): Promise<MemberReputationRow>;
  deleteMany(args: { where: { address: string } }): Promise<{ count: number }>;
  findMany(args: {
    orderBy: { score: 'asc' | 'desc' };
    take: number;
  }): Promise<MemberReputationRow[]>;
}

export interface MemberReputationPrisma {
  memberReputation: MemberReputationDelegate;
}

export class MemberReputationRepository {
  private _db?: MemberReputationPrisma;

  /**
   * @param db  Prisma client (or a structural mock in tests). Omit in
   *            production — the shared singleton is resolved lazily on first
   *            use so constructing the repository never forces a DB import.
   */
  constructor(db?: MemberReputationPrisma) {
    this._db = db;
  }

  private get db(): MemberReputationPrisma {
    if (!this._db) {
      // Lazy require avoids pulling `prisma_client` into unit tests that inject a mock.
      this._db = require('../../prisma_client').prisma as MemberReputationPrisma;
    }
    return this._db;
  }

  /** Look up a single reputation record by wallet address. */
  findByAddress(address: string): Promise<MemberReputationRow | null> {
    return this.db.memberReputation.findUnique({ where: { address } });
  }

  /** Insert or replace the stored totals/score for an address. */
  upsertTotals(address: string, totals: MemberReputationTotals): Promise<MemberReputationRow> {
    return this.db.memberReputation.upsert({
      where: { address },
      create: { address, ...totals },
      update: totals,
    });
  }

  /** Delete the reputation record for an address (GDPR erasure). Returns rows removed. */
  async deleteByAddress(address: string): Promise<number> {
    const { count } = await this.db.memberReputation.deleteMany({ where: { address } });
    return count;
  }

  /** Highest-scoring members first — powers the reputation leaderboard. */
  topByScore(limit = 20): Promise<MemberReputationRow[]> {
    return this.db.memberReputation.findMany({ orderBy: { score: 'desc' }, take: limit });
  }
}

/** Shared singleton — import this in services. */
export const memberReputationRepository = new MemberReputationRepository();
