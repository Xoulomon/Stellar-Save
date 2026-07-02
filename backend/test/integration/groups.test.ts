import request from 'supertest';
import { buildApp } from '../helpers/app';

const { app } = buildApp();

describe('GET /api/groups', () => {
  it('returns 200 with an array of groups', async () => {
    const res = await request(app).get('/api/groups');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('each group has required fields', async () => {
    const res = await request(app).get('/api/groups');
    for (const group of res.body) {
      expect(group).toHaveProperty('id');
      expect(group).toHaveProperty('name');
      expect(group).toHaveProperty('contributionAmount');
      expect(group).toHaveProperty('maxMembers');
      expect(group).toHaveProperty('status');
    }
  });
});

describe('GET /api/groups/:id', () => {
  it('returns 200 with the matching group', async () => {
    const res = await request(app).get('/api/groups/1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('1');
    expect(res.body.name).toBe('Weekly Savers');
  });

  it('returns 404 for an unknown group id', async () => {
    const res = await request(app).get('/api/groups/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});
