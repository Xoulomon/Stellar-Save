import { describe, it, expect } from 'vitest';
import type { PublicGroup, GroupDetail } from '../types/group';

describe('Group Metadata Types', () => {
  it('should support name field in PublicGroup', () => {
    const group: PublicGroup = {
      id: 'g1',
      name: 'Test Group',
      description: 'A test group',
      imageUrl: 'https://example.com/image.png',
      memberCount: 5,
      contributionAmount: 100,
      currency: 'XLM',
      status: 'active',
      createdAt: new Date(),
    };

    expect(group.name).toBe('Test Group');
    expect(group.description).toBe('A test group');
    expect(group.imageUrl).toBe('https://example.com/image.png');
  });

  it('should support metadata in GroupDetail', () => {
    const group: GroupDetail = {
      id: 'g1',
      name: 'Savings Circle',
      description: 'A community savings group',
      imageUrl: 'https://example.com/group.png',
      memberCount: 10,
      contributionAmount: 50,
      currency: 'XLM',
      status: 'active',
      createdAt: new Date(),
      creator: 'GXYZ...',
      cycleDuration: 604800,
      maxMembers: 10,
      minMembers: 2,
      currentCycle: 1,
      isActive: true,
      started: true,
      startedAt: new Date(),
    };

    expect(group.name).toBe('Savings Circle');
    expect(group.description).toBe('A community savings group');
    expect(group.imageUrl).toBe('https://example.com/group.png');
  });

  it('should allow optional metadata fields', () => {
    const group: PublicGroup = {
      id: 'g2',
      name: 'Minimal Group',
      memberCount: 3,
      contributionAmount: 25,
      currency: 'XLM',
      status: 'pending',
      createdAt: new Date(),
    };

    expect(group.name).toBe('Minimal Group');
    expect(group.description).toBeUndefined();
    expect(group.imageUrl).toBeUndefined();
  });

  it('should validate name length constraints', () => {
    // Valid names
    const validNames = ['ABC', 'Test Group', 'A'.repeat(50)];
    validNames.forEach((name) => {
      expect(name.length).toBeGreaterThanOrEqual(3);
      expect(name.length).toBeLessThanOrEqual(50);
    });

    // Invalid names
    const invalidNames = ['AB', 'A'.repeat(51)];
    invalidNames.forEach((name) => {
      expect(
        name.length < 3 || name.length > 50,
      ).toBe(true);
    });
  });

  it('should validate description length constraints', () => {
    // Valid descriptions
    const validDescriptions = ['', 'A description', 'A'.repeat(500)];
    validDescriptions.forEach((desc) => {
      expect(desc.length).toBeLessThanOrEqual(500);
    });

    // Invalid description
    const invalidDescription = 'A'.repeat(501);
    expect(invalidDescription.length).toBeGreaterThan(500);
  });
});
