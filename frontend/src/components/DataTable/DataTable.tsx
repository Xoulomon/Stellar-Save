/**
 * DataTable — Generic sortable/paginated table component
 *
 * A reusable table that supports:
 * - Client-side or controlled sorting (ascending/descending per column)
 * - Client-side pagination with configurable page size
 * - Loading and empty states
 * - Accessible keyboard navigation
 * - Flexible column definitions with optional custom render functions
 *
 * @example
 * ```tsx
 * const columns: DataTableColumn<Transaction>[] = [
 *   { key: 'createdAt', header: 'Date', sortable: true, render: (row) => formatDate(row.createdAt) },
 *   { key: 'amount', header: 'Amount', sortable: true },
 * ];
 * <DataTable columns={columns} rows={transactions} defaultSortKey="createdAt" defaultSortDir="desc" />
 * ```
 */
import { useState, useMemo, useCallback } from 'react';

import './DataTable.css';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc';

export interface DataTableColumn<T> {
  /** Unique key matching a field on T (or any string for custom columns) */
  key: keyof T | string;
  /** Header label shown in <th> */
  header: string;
  /** Whether this column supports sorting. Defaults to false. */
  sortable?: boolean;
  /**
   * Custom render function. Receives the full row object and returns a
   * ReactNode. If omitted the raw field value is rendered as-is.
   */
  render?: (row: T) => React.ReactNode;
  /** Optional additional className for the <td> cell */
  cellClassName?: string;
  /** Optional additional className for the <th> header */
  headerClassName?: string;
  /** Column width (e.g. "120px", "10%"). Defaults to auto. */
  width?: string;
  /**
   * Custom sort comparator. Receives two row objects and should return
   * negative / zero / positive like Array.sort().
   * Used only when `sortable` is true.
   */
  sortComparator?: (a: T, b: T) => number;
}

export interface DataTableProps<T> {
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Row data array. Each row must have a unique `id` field (or provide `rowKey`). */
  rows: T[];
  /** Function that returns a unique key for each row. Defaults to `(row) => (row as any).id`. */
  rowKey?: (row: T) => string | number;
  /** Whether data is currently loading */
  loading?: boolean;
  /** Message shown in empty state. Defaults to "No data found". */
  emptyMessage?: string;
  /** Loading message used for aria-label. Defaults to "Loading data…" */
  loadingMessage?: string;
  /** Initial sort column key */
  defaultSortKey?: keyof T | string;
  /** Initial sort direction. Defaults to "asc". */
  defaultSortDir?: SortDirection;
  /** Number of rows per page. Set to 0 to disable pagination. */
  pageSize?: number;
  /** Available page size options shown in the selector. */
  pageSizeOptions?: number[];
  /** Called when a row is clicked */
  onRowClick?: (row: T) => void;
  /** Additional class for the table wrapper element */
  className?: string;
  /** Caption text (screen reader accessible). */
  caption?: string;
}

// ── Sort icon ─────────────────────────────────────────────────────────────────

function SortIcon({ direction, active }: { direction: SortDirection | null; active: boolean }) {
  return (
    <span className={`data-table__sort-icon ${active ? 'data-table__sort-icon--active' : ''}`} aria-hidden="true">
      {active && direction === 'asc' ? '▲' : active && direction === 'desc' ? '▼' : '⇅'}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyMessage = 'No data found',
  loadingMessage = 'Loading data…',
  defaultSortKey,
  defaultSortDir = 'asc',
  pageSize: initialPageSize = 10,
  pageSizeOptions = [5, 10, 25, 50],
  onRowClick,
  className = '',
  caption,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | string | null>(defaultSortKey ?? null);
  const [sortDir, setSortDir] = useState<SortDirection>(defaultSortDir);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize > 0 ? initialPageSize : rows.length);

  // ── Sorting ────────────────────────────────────────────────────────────────

  const handleSort = useCallback(
    (key: keyof T | string) => {
      setCurrentPage(1);
      if (sortKey === key) {
        setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey],
  );

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;

    const col = columns.find((c) => c.key === sortKey);

    return [...rows].sort((a, b) => {
      if (col?.sortComparator) {
        return sortDir === 'asc' ? col.sortComparator(a, b) : col.sortComparator(b, a);
      }

      const aVal = (a as Record<string, unknown>)[sortKey as string];
      const bVal = (b as Record<string, unknown>)[sortKey as string];

      // Handle numbers
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
        return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // Handle strings / dates
      const aStr = String(aVal ?? '');
      const bStr = String(bVal ?? '');
      const cmp = aStr.localeCompare(bStr);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir, columns]);

  // ── Pagination ─────────────────────────────────────────────────────────────

  const paginationEnabled = initialPageSize > 0;

  const totalPages = paginationEnabled ? Math.max(1, Math.ceil(sortedRows.length / pageSize)) : 1;

  const pagedRows = useMemo(() => {
    if (!paginationEnabled) return sortedRows;
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize, paginationEnabled]);

  // Clamp page when page count changes (e.g. filter change)
  const safePage = Math.max(1, Math.min(currentPage, totalPages));
  if (safePage !== currentPage) setCurrentPage(safePage);

  const startItem = sortedRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, sortedRows.length);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // ── Row key ────────────────────────────────────────────────────────────────

  const getKey = rowKey ?? ((row: T) => String((row as Record<string, unknown>)['id'] ?? ''));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={`data-table-wrapper ${className}`} data-testid="data-table">
      <div className="data-table-scroll" role="region" aria-label={caption ?? 'Data table'}>
        <table
          className="data-table"
          aria-busy={loading}
          aria-label={caption}
        >
          {caption && <caption className="data-table__caption">{caption}</caption>}

          <colgroup>
            {columns.map((col) => (
              <col key={String(col.key)} style={col.width ? { width: col.width } : undefined} />
            ))}
          </colgroup>

          <thead className="data-table__head">
            <tr>
              {columns.map((col) => {
                const isActive = sortKey === col.key;
                return (
                  <th
                    key={String(col.key)}
                    scope="col"
                    className={[
                      'data-table__th',
                      col.sortable ? 'data-table__th--sortable' : '',
                      isActive ? 'data-table__th--sorted' : '',
                      col.headerClassName ?? '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    onKeyDown={
                      col.sortable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSort(col.key);
                            }
                          }
                        : undefined
                    }
                    tabIndex={col.sortable ? 0 : undefined}
                    aria-sort={
                      col.sortable
                        ? isActive
                          ? sortDir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                        : undefined
                    }
                  >
                    <span className="data-table__th-content">
                      {col.header}
                      {col.sortable && (
                        <SortIcon direction={isActive ? sortDir : null} active={isActive} />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="data-table__body">
            {loading ? (
              // Loading skeleton rows
              Array.from({ length: pageSize > 0 ? Math.min(pageSize, 5) : 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="data-table__row data-table__row--skeleton">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="data-table__td">
                      <span className="data-table__skeleton-cell" role="presentation" aria-hidden="true" />
                    </td>
                  ))}
                </tr>
              ))
            ) : pagedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="data-table__td data-table__td--empty"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pagedRows.map((row) => (
                <tr
                  key={getKey(row)}
                  className={[
                    'data-table__row',
                    onRowClick ? 'data-table__row--clickable' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={['data-table__td', col.cellClassName ?? ''].filter(Boolean).join(' ')}
                    >
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key as string] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Screen-reader-only status for loading */}
      {loading && (
        <p className="data-table__sr-only" role="status" aria-live="polite">
          {loadingMessage}
        </p>
      )}

      {/* Pagination */}
      {paginationEnabled && !loading && sortedRows.length > 0 && (
        <div className="data-table__pagination" role="navigation" aria-label="Table pagination">
          <div className="data-table__pagination-info">
            Showing {startItem}–{endItem} of {sortedRows.length}
          </div>

          <div className="data-table__pagination-controls">
            <button
              className="data-table__page-btn"
              onClick={() => setCurrentPage(1)}
              disabled={safePage === 1}
              aria-label="First page"
            >
              «
            </button>
            <button
              className="data-table__page-btn"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              aria-label="Previous page"
            >
              ‹
            </button>

            <span className="data-table__page-indicator" aria-current="page">
              Page {safePage} of {totalPages}
            </span>

            <button
              className="data-table__page-btn"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              aria-label="Next page"
            >
              ›
            </button>
            <button
              className="data-table__page-btn"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage === totalPages}
              aria-label="Last page"
            >
              »
            </button>
          </div>

          {pageSizeOptions.length > 1 && (
            <div className="data-table__page-size">
              <label htmlFor="data-table-page-size" className="data-table__page-size-label">
                Per page:
              </label>
              <select
                id="data-table-page-size"
                className="data-table__page-size-select"
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              >
                {pageSizeOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DataTable;
