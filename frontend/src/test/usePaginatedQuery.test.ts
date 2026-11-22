import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';

describe('usePaginatedQuery', () => {
  it('initializes with default options', () => {
    const { result } = renderHook(() => usePaginatedQuery());
    expect(result.current.paginationModel).toEqual({ page: 0, pageSize: 10 });
    expect(result.current.sortModel).toEqual([{ field: 'createdAt', sort: 'desc' }]);
  });

  it('updates page (next, previous)', () => {
    const { result } = renderHook(() => usePaginatedQuery({ initialPage: 0, initialPageSize: 10 }));

    // Next page
    act(() => {
      result.current.setPaginationModel({ page: 1, pageSize: 10 });
    });
    expect(result.current.paginationModel.page).toBe(1);

    // Previous page
    act(() => {
      result.current.setPaginationModel({ page: 0, pageSize: 10 });
    });
    expect(result.current.paginationModel.page).toBe(0);
  });

  it('resets pagination correctly', () => {
    const { result } = renderHook(() => usePaginatedQuery({ initialPage: 0, initialPageSize: 20 }));

    act(() => {
      result.current.setPaginationModel({ page: 3, pageSize: 20 });
    });
    expect(result.current.paginationModel.page).toBe(3);

    act(() => {
      result.current.resetPagination();
    });
    expect(result.current.paginationModel).toEqual({ page: 0, pageSize: 20 });
  });

  it('handles sort changes and empty models without error', () => {
    const { result } = renderHook(() => usePaginatedQuery());

    act(() => {
      result.current.setSortModel([{ field: 'amount', sort: 'asc' }]);
    });
    expect(result.current.sortModel).toEqual([{ field: 'amount', sort: 'asc' }]);

    act(() => {
      result.current.setSortModel([]);
    });
    expect(result.current.sortModel).toEqual([]);
  });
});
