import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stack, Typography } from '@mui/material';
import { AppCard, AppLayout } from '../ui';
import { GroupCard } from '../components/GroupCard';
import { GroupFilters } from '../components/GroupFilters';
import { GroupList } from '../components/GroupList';
import { SearchBar } from '../components/SearchBar';
import { JoinGroupModal } from '../components/JoinGroupModal';
import { GroupPreview } from '../components/GroupPreview';
import { ToastProvider } from '../components/Toast/ToastProvider';
import { useToast } from '../components/Toast/useToast';
import { Button } from '../components/Button';
import { useGroups } from '../hooks/useGroups';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { ROUTES } from '../routing/constants';
import type { PublicGroup } from '../types/group';
import type { GroupFilters as GroupFiltersType } from '../types/group';
import './BrowseGroupsPage.css';

const SAVED_SEARCH_KEY = 'stellar-save:search-preferences';

function BrowseGroupsContent() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [savedSearch, setSavedSearch] = useLocalStorage<Partial<GroupFiltersType>>(
    SAVED_SEARCH_KEY,
    {}
  );

  const {
    groups,
    filteredCount,
    pagination,
    filters,
    isLoading,
    error,
    hasActiveFilters,
    setFilters,
    clearFilters,
    setPage,
    setPageSize,
    refresh,
  } = useGroups({ initialFilters: savedSearch, initialPageSize: 10 });

  const [previewGroup, setPreviewGroup] = useState<PublicGroup | null>(null);
  const [joinGroup, setJoinGroup] = useState<PublicGroup | null>(null);

  // Derive autocomplete suggestions from all loaded group names
  const suggestions = useMemo(() => groups.map((g) => g.name), [groups]);

  const handleSearch = (q: string) => {
    setFilters({ search: q });
    setSavedSearch((prev) => ({ ...prev, search: q }));
  };

  const handleFilterChange = (f: Parameters<typeof setFilters>[0]) => {
    setFilters(f);
    setSavedSearch((prev) => ({ ...prev, ...f }));
  };

  const handleClearFilters = () => {
    clearFilters();
    setSavedSearch({});
  };

  const handleJoinConfirm = (group: PublicGroup) => {
    setJoinGroup(null);
    setPreviewGroup(null);
    addToast({
      message: `Join request sent for "${group.name}"!`,
      type: 'success',
      duration: 4000,
    });
  };

  return (
    <>
      <AppCard>
        <Stack spacing={2}>
          <div aria-live="polite" aria-atomic="true">
            {error && (
              <div className="browse-groups-error" role="alert">
                <p>{error}</p>
                <Button onClick={refresh}>Retry</Button>
              </div>
            )}
          </div>

          {!error && (
            <section aria-labelledby="browse-groups-heading">
              <Typography id="browse-groups-heading" variant="h2" sx={{ mb: 2 }}>
                Public Groups
              </Typography>

              <div className="browse-groups-controls">
                <SearchBar
                  placeholder="Search groups by name or keyword..."
                  onSearch={handleSearch}
                  debounceMs={300}
                  loading={isLoading}
                  defaultValue={filters.search}
                  suggestions={suggestions}
                />
                <GroupFilters onFilterChange={handleFilterChange} initialFilters={filters} />
              </div>

              {!isLoading && (
                <p className="browse-groups-result-count" aria-live="polite">
                  {filteredCount} {filteredCount === 1 ? 'group' : 'groups'} found
                  {hasActiveFilters && (
                    <button className="browse-groups-clear-filters" onClick={handleClearFilters}>
                      Clear filters
                    </button>
                  )}
                </p>
              )}

              <div aria-busy={isLoading}>
                <GroupList
                  groups={groups as any}
                  loading={isLoading}
                  showSearch={false}
                  showSort={false}
                  pageSize={pagination.pageSize}
                  pageSizeOptions={[10, 20, 50]}
                  showPagination={filteredCount > pagination.pageSize}
                  emptyTitle={hasActiveFilters ? 'No groups found' : 'No groups available'}
                  emptyDescription={
                    hasActiveFilters
                      ? 'Try adjusting your search or filters.'
                      : 'No public groups yet. Be the first to create one!'
                  }
                  emptyActionLabel={hasActiveFilters ? 'Clear Filters' : 'Create Group'}
                  onEmptyAction={
                    hasActiveFilters ? handleClearFilters : () => navigate(ROUTES.GROUP_CREATE)
                  }
                  renderGroupItem={(group) => (
                    <GroupCard
                      groupId={group.id}
                      groupName={group.name}
                      description={(group as any).description}
                      memberCount={group.memberCount ?? 0}
                      contributionAmount={(group as any).contributionAmount ?? 0}
                      currency={(group as any).currency ?? 'XLM'}
                      status={(group as any).status ?? 'active'}
                      onViewDetails={() => setPreviewGroup(group as any)}
                      onJoin={
                        (group as any).status !== 'completed'
                          ? () => setJoinGroup(group as any)
                          : undefined
                      }
                    />
                  )}
                />
              </div>

              {pagination.totalPages > 1 && (
                <div
                  className="browse-groups-pagination"
                  role="navigation"
                  aria-label="Group list pagination"
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!pagination.hasPrevPage}
                    onClick={() => setPage(pagination.page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="browse-groups-page-info">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!pagination.hasNextPage}
                    onClick={() => setPage(pagination.page + 1)}
                  >
                    Next
                  </Button>
                  <select
                    aria-label="Items per page"
                    value={pagination.pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="browse-groups-page-size"
                  >
                    {[10, 20, 50].map((n) => (
                      <option key={n} value={n}>
                        {n} per page
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </section>
          )}
        </Stack>
      </AppCard>

      {/* Group preview drawer */}
      <GroupPreview
        group={previewGroup}
        onClose={() => setPreviewGroup(null)}
        onJoin={(g) => {
          setPreviewGroup(null);
          setJoinGroup(g);
        }}
      />

      {/* Join confirmation modal */}
      <JoinGroupModal
        group={joinGroup}
        onClose={() => setJoinGroup(null)}
        onConfirm={handleJoinConfirm}
      />
    </>
  );
}

export default function BrowseGroupsPage() {
  const navigate = useNavigate();
  return (
    <ToastProvider>
      <AppLayout
        title="Browse Groups"
        subtitle="Discover and join public savings groups"
        footerText="Stellar Save - Built for transparent, on-chain savings"
        navItems={[
          { key: 'create', label: 'Create Group', onClick: () => navigate(ROUTES.GROUP_CREATE) },
        ]}
      >
        <BrowseGroupsContent />
      </AppLayout>
    </ToastProvider>
  );
}
