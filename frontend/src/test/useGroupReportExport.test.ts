import { describe, it, expect } from 'vitest';
import {
  buildGroupContributionsCSV,
  buildGroupReportPDFHtml,
} from '../hooks/useGroupReportExport';
import type { DetailedGroup } from '../utils/groupApi';

const mockGroup: DetailedGroup = {
  id: 'g1',
  name: 'Test Circle',
  description: 'A test group',
  memberCount: 2,
  contributionAmount: 100,
  currency: 'XLM',
  status: 'active',
  createdAt: new Date('2026-01-01'),
  totalMembers: 2,
  targetAmount: 600,
  currentAmount: 200,
  contributionFrequency: 'monthly',
  cycleDuration: 30,
  members: [
    { id: 'm1', address: 'GAAA1111', name: 'Alice', joinedAt: new Date('2026-01-01'), totalContributions: 200, isActive: true },
    { id: 'm2', address: 'GBBB2222', name: 'Bob', joinedAt: new Date('2026-01-02'), totalContributions: 100, isActive: true },
  ],
  contributions: [
    { id: 'c1', memberId: 'm1', memberName: 'Alice', amount: 100, timestamp: new Date('2026-01-15'), transactionHash: 'tx_abc', status: 'completed' },
    { id: 'c2', memberId: 'm2', memberName: 'Bob', amount: 100, timestamp: new Date('2026-01-16'), transactionHash: 'tx_def', status: 'pending' },
  ],
  cycles: [
    { cycleNumber: 1, startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31'), targetAmount: 200, currentAmount: 200, status: 'completed' },
    { cycleNumber: 2, startDate: new Date('2026-02-01'), endDate: new Date('2026-02-28'), targetAmount: 200, currentAmount: 0, status: 'active' },
  ],
  currentCycle: { cycleNumber: 2, startDate: new Date('2026-02-01'), endDate: new Date('2026-02-28'), targetAmount: 200, currentAmount: 0, status: 'active' },
};

describe('buildGroupContributionsCSV', () => {
  it('includes CSV header row', () => {
    const csv = buildGroupContributionsCSV(mockGroup);
    expect(csv).toContain('Date,Member,Member ID,Amount (XLM),TX Hash,Status');
  });

  it('includes one row per contribution', () => {
    const csv = buildGroupContributionsCSV(mockGroup);
    const lines = csv.trim().split('\n');
    // header + 2 contributions
    expect(lines).toHaveLength(3);
  });

  it('includes member name, amount, and tx hash', () => {
    const csv = buildGroupContributionsCSV(mockGroup);
    expect(csv).toContain('Alice');
    expect(csv).toContain('100');
    expect(csv).toContain('tx_abc');
  });

  it('includes contribution status', () => {
    const csv = buildGroupContributionsCSV(mockGroup);
    expect(csv).toContain('completed');
    expect(csv).toContain('pending');
  });
});

describe('buildGroupReportPDFHtml', () => {
  it('is valid HTML containing the group name', () => {
    const html = buildGroupReportPDFHtml(mockGroup);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Test Circle');
  });

  it('includes pool summary values', () => {
    const html = buildGroupReportPDFHtml(mockGroup);
    // Pool per payout = contributionAmount * totalMembers = 100 * 2 = 200
    expect(html).toContain('200 XLM');
    // Current amount
    expect(html).toContain('200 XLM');
  });

  it('includes cycle history rows', () => {
    const html = buildGroupReportPDFHtml(mockGroup);
    expect(html).toContain('Cycle 1');
    expect(html).toContain('Cycle 2');
    expect(html).toContain('completed');
    expect(html).toContain('active');
  });

  it('includes member names and addresses', () => {
    const html = buildGroupReportPDFHtml(mockGroup);
    expect(html).toContain('Alice');
    expect(html).toContain('Bob');
    expect(html).toContain('GAAA1111');
  });

  it('includes contribution history with tx hashes', () => {
    const html = buildGroupReportPDFHtml(mockGroup);
    expect(html).toContain('tx_abc');
    expect(html).toContain('tx_def');
  });
});
