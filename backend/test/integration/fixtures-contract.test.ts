import request from 'supertest';
import { buildApp } from '../helpers/app';
import {
  buildApiGroup,
  mockApiGroups,
  buildApiMember,
  mockApiMembers,
  buildApiTransaction,
  mockApiTransactions,
} from '@stellar-save/test-fixtures';
import { mockGroups, mockMembers, mockTransactions } from '../../src/mock_data';

const { app } = buildApp();

/** Recursively compares the *shape* (key set + value types) of two objects, ignoring actual values. */
function assertSameShape(actual: unknown, expected: unknown, path = 'root'): void {
  expect(typeof actual).toBe(typeof expected);

  if (Array.isArray(expected)) {
    expect(Array.isArray(actual)).toBe(true);
    return;
  }

  if (expected === null || typeof expected !== 'object') {
    return;
  }

  const actualKeys = Object.keys(actual as object).sort();
  const expectedKeys = Object.keys(expected as object).sort();
  expect(actualKeys, `key mismatch at ${path}`).toEqual(expectedKeys);

  for (const key of expectedKeys) {
    assertSameShape(
      (actual as Record<string, unknown>)[key],
      (expected as Record<string, unknown>)[key],
      `${path}.${key}`
    );
  }
}

describe('shared fixtures match the real API contract', () => {
  it('@stellar-save/test-fixtures mockApiGroups matches backend/src/mock_data.ts mockGroups', () => {
    expect(mockApiGroups).toEqual(mockGroups);
  });

  it('@stellar-save/test-fixtures mockApiMembers matches backend/src/mock_data.ts mockMembers in shape', () => {
    expect(mockApiMembers).toHaveLength(mockMembers.length);
    mockApiMembers.forEach((member, i) => assertSameShape(member, mockMembers[i]));
  });

  it('@stellar-save/test-fixtures mockApiTransactions matches backend/src/mock_data.ts mockTransactions in shape', () => {
    expect(mockApiTransactions).toHaveLength(mockTransactions.length);
    mockApiTransactions.forEach((tx, i) => assertSameShape(tx, mockTransactions[i]));
  });

  it('buildApiGroup() output matches the shape of the real GET /api/groups response', async () => {
    const res = await request(app).get('/api/groups');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);

    const fixtureGroup = buildApiGroup();
    for (const group of res.body) {
      assertSameShape(group, fixtureGroup);
    }
  });

  it('buildApiGroup() output matches the shape of a single GET /api/groups/:id response', async () => {
    const res = await request(app).get('/api/groups/1');
    expect(res.status).toBe(200);
    assertSameShape(res.body, buildApiGroup());
  });

  it('buildApiMember()/buildApiTransaction() factories produce objects shaped like the canonical mock data', () => {
    assertSameShape(buildApiMember(), mockMembers[0]);
    assertSameShape(buildApiTransaction(), mockTransactions[0]);
  });
});
