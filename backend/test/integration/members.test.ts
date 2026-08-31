import request from 'supertest';
import { buildApp } from '../helpers/app';

const { app, prisma } = buildApp();

const TEST_ADDRESS = 'GTEST_MEMBER_ADDR_001';

afterAll(async () => {
  await prisma.memberReputation.deleteMany({ where: { address: TEST_ADDRESS } });
  await prisma.$disconnect();
});

describe('GET /api/members/:address/reputation', () => {
  it('returns 200 with default reputation for unknown address', async () => {
    const res = await request(app).get('/api/members/GUNKNOWN/reputation');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      address: 'GUNKNOWN',
      score: expect.any(Number),
      totalContributions: expect.any(Number),
      onTimeContributions: expect.any(Number),
      updatedAt: expect.any(String),
    });
  });

  it('returns the stored reputation after a record is seeded', async () => {
    await prisma.memberReputation.upsert({
      where: { address: TEST_ADDRESS },
      create: { address: TEST_ADDRESS, totalContributions: 10, onTimeContributions: 8, score: 0.8 },
      update: { totalContributions: 10, onTimeContributions: 8, score: 0.8 },
    });

    const res = await request(app).get(`/api/members/${TEST_ADDRESS}/reputation`);
    expect(res.status).toBe(200);
    expect(res.body.address).toBe(TEST_ADDRESS);
    expect(res.body.score).toBeCloseTo(0.8);
    expect(res.body.totalContributions).toBe(10);
    expect(res.body.onTimeContributions).toBe(8);
  });

  it('score is between 0 and 1', async () => {
    const res = await request(app).get(`/api/members/${TEST_ADDRESS}/reputation`);
    expect(res.body.score).toBeGreaterThanOrEqual(0);
    expect(res.body.score).toBeLessThanOrEqual(1);
  });
});

describe('GET /api/members/:address/export.csv', () => {
  it('returns 200 with CSV content-type for a known address', async () => {
    const res = await request(app).get('/api/members/G...ALICE/export.csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
  });

  it('returns CSV with header row', async () => {
    const res = await request(app).get('/api/members/G...ALICE/export.csv');
    expect(res.text).toMatch(/date,group_id,type,amount,transaction_hash/);
  });

  it('returns empty CSV (headers only) for address with no transactions', async () => {
    const res = await request(app).get('/api/members/GNODATA/export.csv');
    expect(res.status).toBe(200);
    // Only the header row, no data rows
    const lines = res.text.trim().split('\n');
    expect(lines).toHaveLength(1);
  });
});
