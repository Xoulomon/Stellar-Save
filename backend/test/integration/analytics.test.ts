import request from 'supertest';
import { buildApp } from '../helpers/app';

const { app, prisma } = buildApp();

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

const TEST_USER_ID = 'integration-test-user-' + Date.now();
const TEST_GROUP_ID = 'integration-test-group-' + Date.now();

beforeAll(async () => {
  await prisma.platformMetrics.upsert({
    where: { date: TODAY },
    create: {
      date: TODAY,
      totalUsers: 50,
      activeUsers: 30,
      totalGroups: 10,
      activeGroups: 8,
      totalContributions: 200,
      totalContributionAmount: 2000,
      totalPayouts: 150,
      totalPayoutAmount: 1500,
      averageGroupSize: 5,
      successRate: 75,
      totalTransactions: 350,
      uniqueWallets: 40,
    },
    update: {},
  });

  await prisma.userMetrics.upsert({
    where: { userId_date: { userId: TEST_USER_ID, date: TODAY } },
    create: {
      userId: TEST_USER_ID,
      date: TODAY,
      groupsJoined: 3,
      groupsCreated: 1,
      groupsCompleted: 0,
      totalContributions: 5,
      totalContributionAmount: 250,
      totalPayoutsReceived: 0,
      sessionsCount: 4,
      sessionDurationMinutes: 60,
      pageViews: 20,
      interactionCount: 40,
    },
    update: {},
  });

  await prisma.groupMetrics.upsert({
    where: { groupId_date: { groupId: TEST_GROUP_ID, date: TODAY } },
    create: {
      groupId: TEST_GROUP_ID,
      date: TODAY,
      memberCount: 5,
      totalContributions: 20,
      totalContributionAmount: 1000,
      totalPayoutsDistributed: 800,
      successRate: 80,
      averageContributionSize: 50,
      newMembersCount: 2,
      churnCount: 0,
    },
    update: {},
  });
});

afterAll(async () => {
  await prisma.platformMetrics.deleteMany({ where: { date: TODAY } });
  await prisma.userMetrics.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.groupMetrics.deleteMany({ where: { groupId: TEST_GROUP_ID } });
  await prisma.analyticsEvent.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.analyticsReport.deleteMany({ where: { generatedBy: TEST_USER_ID } });
  await prisma.$disconnect();
});

describe('GET /api/v1/analytics/platform', () => {
  it('returns 200 with platform stats for today', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/platform')
      .query({ date: TODAY.toISOString() });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalUsers: expect.any(Number),
      activeUsers: expect.any(Number),
      totalGroups: expect.any(Number),
    });
  });

  it('returns 404 for a date with no data', async () => {
    const future = new Date('2099-01-01').toISOString();
    const res = await request(app)
      .get('/api/v1/analytics/platform')
      .query({ date: future });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/analytics/platform/trends', () => {
  it('returns 400 when date range is missing', async () => {
    const res = await request(app).get('/api/v1/analytics/platform/trends');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns trend data for a valid date range', async () => {
    const start = new Date(TODAY);
    start.setDate(start.getDate() - 3);
    const res = await request(app)
      .get('/api/v1/analytics/platform/trends')
      .query({ startDate: start.toISOString(), endDate: TODAY.toISOString() });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('trends');
    expect(Array.isArray(res.body.trends)).toBe(true);
  });
});

describe('GET /api/v1/analytics/users/:userId', () => {
  it('returns 200 with user stats for seeded user', async () => {
    const res = await request(app)
      .get(`/api/v1/analytics/users/${TEST_USER_ID}`)
      .query({ date: TODAY.toISOString() });
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(TEST_USER_ID);
    expect(res.body.groupsJoined).toBe(3);
  });

  it('returns 404 for unknown user', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/users/no-such-user-xyz')
      .query({ date: new Date('2099-01-01').toISOString() });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/analytics/groups/:groupId', () => {
  it('returns 200 with group stats for seeded group', async () => {
    const res = await request(app)
      .get(`/api/v1/analytics/groups/${TEST_GROUP_ID}`)
      .query({ date: TODAY.toISOString() });
    expect(res.status).toBe(200);
    expect(res.body.groupId).toBe(TEST_GROUP_ID);
    expect(res.body.memberCount).toBe(5);
  });

  it('returns 404 for unknown group', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/groups/no-such-group-xyz')
      .query({ date: new Date('2099-01-01').toISOString() });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/analytics/events', () => {
  it('returns 201 when event is recorded', async () => {
    const res = await request(app)
      .post('/api/v1/analytics/events')
      .send({ eventType: 'page_view', eventName: 'dashboard', userId: TEST_USER_ID });
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/recorded/i);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/analytics/events')
      .send({ userId: TEST_USER_ID });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('persists the event in the database', async () => {
    await request(app)
      .post('/api/v1/analytics/events')
      .send({ eventType: 'click', eventName: 'join_button', userId: TEST_USER_ID });

    const events = await prisma.analyticsEvent.findMany({
      where: { userId: TEST_USER_ID, eventType: 'click' },
    });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].eventName).toBe('join_button');
  });
});

describe('GET /api/v1/analytics/events', () => {
  it('returns 200 with event list', async () => {
    const res = await request(app).get('/api/v1/analytics/events');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('events');
    expect(Array.isArray(res.body.events)).toBe(true);
  });
});

describe('POST /api/v1/analytics/reports', () => {
  it('returns 201 with the generated report', async () => {
    const start = new Date(TODAY);
    start.setDate(start.getDate() - 7);
    const res = await request(app)
      .post('/api/v1/analytics/reports')
      .send({
        reportType: 'weekly',
        reportName: 'Integration Test Report',
        startDate: start.toISOString(),
        endDate: TODAY.toISOString(),
        generatedBy: TEST_USER_ID,
      });
    expect(res.status).toBe(201);
    expect(res.body.reportType).toBe('weekly');
    expect(res.body).toHaveProperty('id');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/analytics/reports')
      .send({ reportType: 'weekly' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /api/v1/analytics/reports', () => {
  it('returns 200 with report list', async () => {
    const res = await request(app).get('/api/v1/analytics/reports');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reports');
    expect(Array.isArray(res.body.reports)).toBe(true);
  });
});
