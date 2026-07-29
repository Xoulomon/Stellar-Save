import { describe, it, expect } from 'vitest';
import {
  buildApiGroup,
  mockApiGroups,
  buildPublicGroup,
  mockPublicGroups,
  buildApiMember,
  mockApiMembers,
  buildGroupMember,
  buildMemberProfile,
  buildApiTransaction,
  mockApiTransactions,
  buildSdkTransaction,
} from './index';

describe('group fixtures', () => {
  it('buildApiGroup applies overrides on top of defaults', () => {
    const group = buildApiGroup({ id: '42', name: 'Overridden' });
    expect(group.id).toBe('42');
    expect(group.name).toBe('Overridden');
    expect(group.status).toBe('Active');
  });

  it('mockApiGroups has the canonical three seed groups', () => {
    expect(mockApiGroups).toHaveLength(3);
    expect(mockApiGroups.map((g) => g.id)).toEqual(['1', '2', '3']);
  });

  it('buildPublicGroup applies overrides on top of defaults', () => {
    const group = buildPublicGroup({ status: 'pending' });
    expect(group.status).toBe('pending');
    expect(group.currency).toBe('XLM');
  });

  it('mockPublicGroups has distinct ids', () => {
    const ids = new Set(mockPublicGroups.map((g) => g.id));
    expect(ids.size).toBe(mockPublicGroups.length);
  });
});

describe('member fixtures', () => {
  it('buildApiMember applies overrides on top of defaults', () => {
    const member = buildApiMember({ address: 'G...OVERRIDE' });
    expect(member.address).toBe('G...OVERRIDE');
  });

  it('mockApiMembers has the canonical three seed members', () => {
    expect(mockApiMembers).toHaveLength(3);
  });

  it('buildGroupMember applies overrides on top of defaults', () => {
    const member = buildGroupMember({ isActive: false });
    expect(member.isActive).toBe(false);
    expect(member.totalContributions).toBe(500);
  });

  it('buildMemberProfile applies overrides on top of defaults', () => {
    const profile = buildMemberProfile({ status: 'inactive', streak: 0 });
    expect(profile.status).toBe('inactive');
    expect(profile.streak).toBe(0);
  });
});

describe('transaction fixtures', () => {
  it('buildApiTransaction applies overrides on top of defaults', () => {
    const tx = buildApiTransaction({ type: 'payout' });
    expect(tx.type).toBe('payout');
  });

  it('mockApiTransactions has the canonical seed transactions', () => {
    expect(mockApiTransactions).toHaveLength(2);
  });

  it('buildSdkTransaction applies overrides on top of defaults', () => {
    const tx = buildSdkTransaction({ type: 'withdraw', amount: '-50' });
    expect(tx.type).toBe('withdraw');
    expect(tx.amount).toBe('-50');
  });
});
