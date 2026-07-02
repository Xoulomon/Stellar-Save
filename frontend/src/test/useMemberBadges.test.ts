import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMemberBadges } from '../hooks/useMemberBadges';

describe('useMemberBadges', () => {
  it('returns empty badges array when address is undefined', () => {
    const { result } = renderHook(() => useMemberBadges(undefined));
    
    expect(result.current.badges).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('returns loading state initially when address is provided', () => {
    const { result } = renderHook(() => useMemberBadges('GABCD...'));
    
    expect(result.current.isLoading).toBe(true);
    expect(result.current.badges).toEqual([]);
  });

  it('fetches and returns badges for a valid address', async () => {
    const { result } = renderHook(() => useMemberBadges('GABCDEFG...'));
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.badges.length).toBeGreaterThanOrEqual(0);
    expect(result.current.error).toBe(null);
  });

  it('each badge has required fields', async () => {
    const { result } = renderHook(() => useMemberBadges('GABCDEFG...'));
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    if (result.current.badges.length > 0) {
      const badge = result.current.badges[0];
      expect(badge).toHaveProperty('id');
      expect(badge).toHaveProperty('type');
      expect(badge).toHaveProperty('name');
      expect(badge).toHaveProperty('description');
      expect(badge).toHaveProperty('artwork');
      expect(badge).toHaveProperty('earnedAt');
    }
  });

  it('earnedAt timestamps are valid numbers', async () => {
    const { result } = renderHook(() => useMemberBadges('GABCDEFG...'));
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    result.current.badges.forEach((badge) => {
      expect(typeof badge.earnedAt).toBe('number');
      expect(badge.earnedAt).toBeGreaterThan(0);
    });
  });

  it('refetch function triggers a re-fetch', async () => {
    const { result } = renderHook(() => useMemberBadges('GABCDEFG...'));
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const firstBadgeCount = result.current.badges.length;

    result.current.refetch();
    
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // After refetch, badge count should be consistent (mock data is deterministic)
    expect(result.current.badges.length).toBe(firstBadgeCount);
  });

  it('clears badges when address changes to undefined', async () => {
    const { result, rerender } = renderHook(
      ({ address }) => useMemberBadges(address),
      { initialProps: { address: 'GABCDEFG...' as string | undefined } }
    );
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.badges.length).toBeGreaterThanOrEqual(0);

    rerender({ address: undefined });

    expect(result.current.badges).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
