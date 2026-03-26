import { useState, useMemo } from 'react';
import { Card } from './Card';
import { SearchBar } from './SearchBar';
import { Pagination } from './Pagination';
import { Dropdown } from './Dropdown';
import { EmptyState } from './EmptyState/EmptyState';
import { GroupSkeleton } from './Skeleton/GroupSkeleton';
import './GroupList.css';

export interface Group {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
  createdAt?: Date;
  avatar?: string;
  [key: string]: any;
}

type SortField = 'name' | 'memberCount' | 'createdAt';
type SortOrder = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  order: SortOrder;
}

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
}: GroupListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: defaultSortField,
    order: defaultSortOrder,
  });

  // Filter groups based on search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;

    const query = searchQuery.toLowerCase();
    return groups.filter(
      (group) =>
        group.name.toLowerCase().includes(query) ||
        group.description?.toLowerCase().includes(query)
    );
  }, [groups, searchQuery]);

  // Sort filtered groups
  const sortedGroups = useMemo(() => {
    const sorted = [...filteredGroups];

    sorted.sort((a, b) => {
      let aValue: any = a[sortConfig.field];
      let bValue: any = b[sortConfig.field];

      // Handle undefined values
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;

      // Handle dates
      if (aValue instanceof Date && bValue instanceof Date) {
        aValue = aValue.getTime();
        bValue = bValue.getTime();
      }

      // Handle strings (case-insensitive)
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortConfig.order === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.order === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredGroups, sortConfig]);

  // Paginate sorted groups
  const paginatedGroups = useMemo(() => {
    if (!showPagination) return sortedGroups;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedGroups.slice(startIndex, endIndex);
  }, [sortedGroups, currentPage, pageSize, showPagination]);

  const totalPages = Math.ceil(sortedGroups.length / pageSize);

  // Reset to page 1 when search or sort changes
  const handleSearch = (value: string) => {
    setSearchQuery(value);
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
          <img
            src={group.avatar}
            alt={group.name}
            className="group-list-item-avatar"
          />
        )}
        {!group.avatar && (
          <div className="group-list-item-avatar-placeholder">
            {group.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="group-list-item-details">
          <h3 className="group-list-item-name">{group.name}</h3>
          {group.description && (
            <p className="group-list-item-description">{group.description}</p>
          )}
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
              />
            </div>
          )}
          {showSort && (
            <Dropdown
              trigger={
                <button className="group-list-sort-button">
                  Sort: {getSortLabel()}
                </button>
              }
              items={sortItems}
              position="bottom-end"
            />
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

      {showPagination && !loading && sortedGroups.length > 0 && (
        <div className="group-list-pagination">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={sortedGroups.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={handlePageSizeChange}
            pageSizeOptions={pageSizeOptions}
          />
        </div>
      )}
    </div>
  );
}
