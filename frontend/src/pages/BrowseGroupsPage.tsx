import { useNavigate } from 'react-router-dom';
import { Stack, Typography } from '@mui/material';
import { AppCard, AppLayout } from '../ui';
import { GroupCard } from '../components/GroupCard';
import { GroupFilters } from '../components/GroupFilters';
import { GroupList, type Group } from '../components/GroupList';
import { SearchBar } from '../components/SearchBar';
import { Button } from '../components/Button';
import { useGroups } from '../hooks/useGroups';
import { ROUTES, buildRoute } from '../routing/constants';
import type { PublicGroup } from '../utils/groupApi';
import './BrowseGroupsPage.css';

export default function BrowseGroupsPage() {
  const navigate = useNavigate();

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
  } = useGroups({ initialPageSize: 12 });

  const handleCreateGroup = () => navigate(ROUTES.GROUP_CREATE);

  return (
    <AppLayout
      title="Browse Groups"
      subtitle="Discover and join public savings groups"
      footerText="Stellar Save - Built for transparent, on-chain savings"
    >
      <AppCard>
        <Stack spacing={2}>
          {/* aria-live region for error/status announcements */}
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
                  onSearch={(q) => setFilters({ search: q })}
                  debounceMs={300}
                  loading={isLoading}
                  aria-label="Search groups"
                />
                <GroupFilters
                  onFilterChange={(f) => setFilters(f)}
                  initialFilters={filters}
                />
              </div>

              <div aria-busy={isLoading}>
                <GroupList
                  groups={groups as Group[]}
                  loading={isLoading}
                  showSearch={false}
                  showSort={false}
                  pageSize={pagination.pageSize}
                  pageSizeOptions={[12, 24, 48]}
                  showPagination={filteredCount > pagination.pageSize}
                  emptyTitle={hasActiveFilters ? 'No groups found' : 'No groups available'}
                  emptyDescription={
                    hasActiveFilters
                      ? 'Try adjusting your search or filters to find groups.'
                      : 'There are no public groups yet. Be the first to create one!'
                  }
                  emptyActionLabel={hasActiveFilters ? 'Clear Filters' : 'Create Group'}
                  onEmptyAction={hasActiveFilters ? clearFilters : handleCreateGroup}
                  renderGroupItem={(group) => {
                    // PublicGroup fields beyond the base Group interface are accessed via type assertion;
                    // GroupCard requires contributionAmount/currency/status which PublicGroup carries.
                    const pg = group as PublicGroup;
                    return (
                      <GroupCard
                        groupId={pg.id}
                        groupName={pg.name}
                        memberCount={pg.memberCount ?? 0}
                        contributionAmount={pg.contributionAmount ?? 0}
                        currency={pg.currency ?? 'XLM'}
                        status={pg.status ?? 'active'}
                        onViewDetails={() => navigate(buildRoute.groupDetail(pg.id))}
                        onJoin={
                          pg.status === 'active' || pg.status === 'pending'
                            ? () => navigate(buildRoute.groupDetail(pg.id))
                            : undefined
                        }
                      />
                    );
                  }}
                />
              </div>

              {/* Pagination controls driven by the hook */}
              {pagination.totalPages > 1 && (
                <div className="browse-groups-pagination" role="navigation" aria-label="Group list pagination">
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
                    {[12, 24, 48].map((n) => (
                      <option key={n} value={n}>{n} per page</option>
                    ))}
                  </select>
                </div>
              )}
            </section>
          )}
        </Stack>
      </AppCard>
    </AppLayout>
  );
}
