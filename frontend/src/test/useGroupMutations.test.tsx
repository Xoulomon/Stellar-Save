import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';


import { useGroupMutations } from '../hooks/useGroupMutations';
import * as groupApi from '../utils/groupApi';

import type { GroupData } from '../utils/groupApi';
import type { ReactNode } from 'react';

const groupData: GroupData = {
  name: 'Alpha Group',
  description: 'First group',
  image_url: '',
  contribution_amount: 1_000_000_0,
  cycle_duration: 604800,
  max_members: 10,
  min_members: 2,
  insuranceEnabled: false,
  insurancePremiumRate: 0,
};

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { ...renderHook(() => useGroupMutations(), { wrapper }), invalidate };
}

beforeEach(() => {
  vi.spyOn(groupApi, 'createGroup').mockResolvedValue('group-1');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useGroupMutations', () => {
  it('is idle before any mutation runs', () => {
    const { result } = setup();
    expect(result.current.isCreating).toBe(false);
    expect(result.current.createError).toBeNull();
  });

  it('forwards the payload to the API and returns the new group id', async () => {
    const { result } = setup();

    let id = '';
    await act(async () => {
      id = await result.current.createGroup(groupData);
    });

    expect(id).toBe('group-1');
    expect(groupApi.createGroup).toHaveBeenCalledWith(groupData);
  });

  it('invalidates every group list variant on success', async () => {
    const { result, invalidate } = setup();

    await act(async () => {
      await result.current.createGroup(groupData);
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['groups'] });
  });

  it('exposes the failure message and does not invalidate on error', async () => {
    vi.spyOn(groupApi, 'createGroup').mockRejectedValue(new Error('contract reverted'));
    const { result, invalidate } = setup();

    await act(async () => {
      await expect(result.current.createGroup(groupData)).rejects.toThrow('contract reverted');
    });

    await waitFor(() => expect(result.current.createError).toBe('contract reverted'));
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('clears a previous error when reset is called', async () => {
    vi.spyOn(groupApi, 'createGroup').mockRejectedValue(new Error('contract reverted'));
    const { result } = setup();

    await act(async () => {
      await expect(result.current.createGroup(groupData)).rejects.toThrow();
    });
    await waitFor(() => expect(result.current.createError).toBe('contract reverted'));

    act(() => {
      result.current.reset();
    });

    await waitFor(() => expect(result.current.createError).toBeNull());
  });
});
