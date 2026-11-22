import { useState, useMemo, type ChangeEvent } from 'react';

import { Card } from './Card';
import { Dropdown } from './Dropdown';
import { EmptyState } from './EmptyState/EmptyState';
import { Pagination } from './Pagination';
import { SearchBar } from './SearchBar';
import { GroupSkeleton } from './Skeleton/GroupSkeleton';
import { queryGroups, type SortConfig, type SortField } from '../utils/groupListQueries';
import './GroupList.css';

export interface Group {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
  contributionAmount?: number;
  currency?: string;
  createdAt?: Date;
  avatar?: string;
  [key: string]: unknown;
}

type SortOrder = 'asc' | 'desc';

interface GroupListProps {
  groups?: Group[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  onGroupClick?: (group: Group) => void;
  renderGroupItem?: (group: Group) => React.ReactNode;
  pageSize?: number;
  pageSizeOptions?: number[];
  showPagination?: boolean;
  showSearch?: boolean;
  showSort?: boolean;
  searchPlaceholder?: string;
  defaultSortField?: SortField;
  defaultSortOrder?: SortOrder;
  className?: string;
  /** Controlled search query (for URL param sync) */
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  /** Token type filter (e.g. "XLM", "USDC") */
  currencyFilter?: string;
  onCurrencyChange?: (value: string) => void;
  /** Amount range filter */
  minAmount?: string;
  maxAmount?: string;
  onMinAmountChange?: (value: string) => void;
  onMaxAmountChange?: (value: string) => void;
}

export function GroupList({
  groups = [],
  loading = false,
  emptyTitle = 'No groups found',
  emptyDescription = 'There are no groups to display.',
  emptyActionLabel,
  onEmptyAction,
  onGroupClick,
  renderGroupItem,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [10, 25, 50],
  showPagination = true,
  showSearch = true,
  showSort = true,
  searchPlaceholder = 'Search groups...',
  defaultSortField = 'name',
  defaultSortOrder = 'asc',
  className = '',
  searchQuery: controlledSearch,
  onSearchChange,
  currencyFilter = '',
  onCurrencyChange,
  minAmount = '',
  maxAmount = '',
  onMinAmountChange,
  onMaxAmountChange,
}: GroupListProps) {
  const [internalSearch, setInternalSearch] = useState('');
  const searchQuery = controlledSearch !== undefined ? controlledSearch : internalSearch;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: defaultSortField,
    order: defaultSortOrder,
  });

  // Single memoized query: filter → sort → paginate
  const { items: paginatedGroups, totalCount: sortedCount, totalPages } = useMemo(
    () =>
      queryGroups(groups, {
        searchQuery,
        currencyFilter,
        minAmount,
        maxAmount,
        sort: sortConfig,
        page: currentPage,
        pageSize,
        paginate: showPagination,
      }),
    [groups, searchQuery, currencyFilter, minAmount, maxAmount, sortConfig, currentPage, pageSize, showPagination],
  );

  // Reset to page 1 when search or sort changes
  const handleSearch = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value);
    } else {
      setInternalSearch(value);
    }
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    setSortConfig((prev) => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
    }));
    setCurrentPage(1);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const handleCurrencyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onCurrencyChange?.(e.target.value);
    setCurrentPage(1);
  };

  const handleMinAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    onMinAmountChange?.(e.target.value);
    setCurrentPage(1);
  };

  const handleMaxAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    onMaxAmountChange?.(e.target.value);
    setCurrentPage(1);
  };

  const getSortLabel = () => {
    const fieldLabels: Record<SortField, string> = {
      name: 'Name',
      memberCount: 'Members',
      createdAt: 'Date Created',
    };
    const orderIcon = sortConfig.order === 'asc' ? '↑' : '↓';
    return `${fieldLabels[sortConfig.field]} ${orderIcon}`;
  };

  const sortItems = [
    {
      id: 'name',
      label: 'Name',
      onClick: () => handleSort('name'),
    },
    {
      id: 'memberCount',
      label: 'Members',
      onClick: () => handleSort('memberCount'),
    },
    {
      id: 'createdAt',
      label: 'Date Created',
      onClick: () => handleSort('createdAt'),
    },
  ];

  const defaultRenderGroupItem = (group: Group) => (
    <Card
      key={group.id}
      variant="outlined"
      hoverable
      onClick={() => onGroupClick?.(group)}
      className="group-list-item"
    >
      <div className="group-list-item-content">
        {group.avatar && (
          <img src={group.avatar} alt={group.name} className="group-list-item-avatar" />
        )}
        {!group.avatar && (
          <div className="group-list-item-avatar-placeholder">
            {group.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="group-list-item-details">
          <h3 className="group-list-item-name">{group.name}</h3>
          {group.description && <p className="group-list-item-description">{group.description}</p>}
          <div className="group-list-item-meta">
            {group.memberCount !== undefined && (
              <span className="group-list-item-members">
                {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
              </span>
            )}
            {group.createdAt && (
              <span className="group-list-item-date">
                {new Date(group.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );

  const renderItem = renderGroupItem || defaultRenderGroupItem;

  return (
    <div className={`group-list ${className}`}>
      {(showSearch || showSort) && (
        <div className="group-list-controls">
          {showSearch && (
            <div className="group-list-search">
              <SearchBar
                placeholder={searchPlaceholder}
                onSearch={handleSearch}
                loading={loading}
                defaultValue={searchQuery}
              />
            </div>
          )}
          {showSort && (
            <Dropdown
              trigger={<button className="group-list-sort-button">Sort: {getSortLabel()}</button>}
              items={sortItems}
              position="bottom-end"
            />
          )}
        </div>
      )}

      {/* Filter panel: token type + amount range */}
      {(onCurrencyChange || onMinAmountChange || onMaxAmountChange) && (
        <div className="group-list-filters" role="search" aria-label="Filter groups">
          {onCurrencyChange && (
            <label className="group-list-filter-label">
              Token type
              <input
                type="text"
                className="group-list-filter-input"
                placeholder="e.g. XLM"
                value={currencyFilter}
                onChange={handleCurrencyChange}
                aria-label="Filter by token type"
              />
            </label>
          )}
          {(onMinAmountChange || onMaxAmountChange) && (
            <fieldset className="group-list-filter-range">
              <legend>Amount range</legend>
              <input
                type="number"
                className="group-list-filter-input"
                placeholder="Min"
                value={minAmount}
                onChange={handleMinAmountChange}
                aria-label="Minimum contribution amount"
              />
              <span aria-hidden>–</span>
              <input
                type="number"
                className="group-list-filter-input"
                placeholder="Max"
                value={maxAmount}
                onChange={handleMaxAmountChange}
                aria-label="Maximum contribution amount"
              />
            </fieldset>
          )}
        </div>
      )}

      <div className="group-list-content">
        {loading ? (
          <div className="group-list-loading">
            {Array.from({ length: pageSize }).map((_, index) => (
              <Card key={index} variant="outlined" className="group-list-item">
                <GroupSkeleton />
              </Card>
            ))}
          </div>
        ) : paginatedGroups.length > 0 ? (
          <div className="group-list-items">
            {paginatedGroups.map((group) => renderItem(group))}
          </div>
        ) : (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            actionLabel={emptyActionLabel}
            onAction={onEmptyAction}
          />
        )}
      </div>

      {showPagination && !loading && sortedCount > 0 && (
        <div className="group-list-pagination">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={sortedCount}
            onPageChange={setCurrentPage}
            onPageSizeChange={handlePageSizeChange}
            pageSizeOptions={pageSizeOptions}
          />
        </div>
      )}
    </div>
  );
}
