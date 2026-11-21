import { useState, useCallback } from 'react';
import type { GridSortModel } from '@mui/x-data-grid';

export interface PaginationState {
  page: number;
  pageSize: number;
}

export interface UsePaginatedQueryOptions {
  initialPage?: number;
  initialPageSize?: number;
  initialSort?: GridSortModel;
}

export interface UsePaginatedQueryResult {
  paginationModel: PaginationState;
  sortModel: GridSortModel;
  setPaginationModel: (model: PaginationState) => void;
  setSortModel: (model: GridSortModel) => void;
  resetPagination: () => void;
}

export function usePaginatedQuery({
  initialPage = 0,
  initialPageSize = 10,
  initialSort = [{ field: 'createdAt', sort: 'desc' as const }],
}: UsePaginatedQueryOptions = {}): UsePaginatedQueryResult {
  const [paginationModel, setPaginationModel] = useState<PaginationState>({
    page: initialPage,
    pageSize: initialPageSize,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>(initialSort);

  const resetPagination = useCallback(() => {
    setPaginationModel({ page: initialPage, pageSize: initialPageSize });
  }, [initialPage, initialPageSize]);

  return { paginationModel, sortModel, setPaginationModel, setSortModel, resetPagination };
}
