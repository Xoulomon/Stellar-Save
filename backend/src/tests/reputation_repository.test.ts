import {
  MemberReputationRepository,
  MemberReputationPrisma,
} from '../modules/reputation/reputation.repository';

function mockDb() {
  return {
    memberReputation: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
  };
}

describe('MemberReputationRepository', () => {
  let db: ReturnType<typeof mockDb>;
  let repo: MemberReputationRepository;

  beforeEach(() => {
    db = mockDb();
    repo = new MemberReputationRepository(db as unknown as MemberReputationPrisma);
  });

  it('findByAddress delegates to prisma.findUnique with the address filter', async () => {
    const row = { address: 'GABC', score: 0.5, totalContributions: 2, onTimeContributions: 1, updatedAt: new Date() };
    db.memberReputation.findUnique.mockResolvedValue(row);

    await expect(repo.findByAddress('GABC')).resolves.toBe(row);
    expect(db.memberReputation.findUnique).toHaveBeenCalledWith({ where: { address: 'GABC' } });
  });

  it('upsertTotals builds matching create + update payloads', async () => {
    db.memberReputation.upsert.mockResolvedValue({});
    const totals = { totalContributions: 4, onTimeContributions: 3, score: 0.75 };

    await repo.upsertTotals('GXYZ', totals);

    expect(db.memberReputation.upsert).toHaveBeenCalledWith({
      where: { address: 'GXYZ' },
      create: { address: 'GXYZ', ...totals },
      update: totals,
    });
  });

  it('deleteByAddress returns the deleted row count', async () => {
    db.memberReputation.deleteMany.mockResolvedValue({ count: 1 });
    await expect(repo.deleteByAddress('GDEL')).resolves.toBe(1);
    expect(db.memberReputation.deleteMany).toHaveBeenCalledWith({ where: { address: 'GDEL' } });
  });

  it('topByScore orders by score desc with a bounded take', async () => {
    db.memberReputation.findMany.mockResolvedValue([]);
    await repo.topByScore(5);
    expect(db.memberReputation.findMany).toHaveBeenCalledWith({ orderBy: { score: 'desc' }, take: 5 });
  });

  it('topByScore defaults the limit to 20', async () => {
    db.memberReputation.findMany.mockResolvedValue([]);
    await repo.topByScore();
    expect(db.memberReputation.findMany).toHaveBeenCalledWith({ orderBy: { score: 'desc' }, take: 20 });
  });
});
