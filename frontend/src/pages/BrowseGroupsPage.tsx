import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stack, Typography } from '@mui/material';
import { AppCard, AppLayout } from '../ui';
import { GroupCard } from '../components/GroupCard';
import { GroupFilters } from '../components/GroupFilters';
import { SearchBar } from '../components/SearchBar';
import { JoinGroupModal } from '../components/JoinGroupModal';
import { ToastProvider } from '../components/Toast/ToastProvider';
import { useToast } from '../components/Toast/useToast';
import { Button } from '../components/Button';
import { GroupCardSkeleton } from '../components/Skeleton/GroupCardSkeleton';
import { EmptyState } from '../components/EmptyState/EmptyState';
import { useDiscoveryFeed } from '../hooks/useDiscoveryFeed';
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
    recommendations,
    filters,
    isLoading,
    error,
    hasMore,
    totalCount,
    setFilters,
    clearFilters,
    refresh,
    loadMore,
  } = useDiscoveryFeed({ initialPageSize: 6 });

  const [joinGroup, setJoinGroup] = useState<PublicGroup | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters =
    filters.search.trim() !== '' ||
    filters.status !== 'all' ||
    filters.minAmount !== '' ||
    filters.maxAmount !== '' ||
    filters.minMembers !== '' ||
    filters.maxMembers !== '';

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
    addToast({ message: `Join request sent for "${group.name}"!`, type: 'success', duration: 4000 });
  };

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore, recommendations.length]);

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
                Browse Groups
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
                <div className="browse-groups-controls-right">
                  <GroupFilters onFilterChange={(f) => setFilters(f)} initialFilters={filters} />
                  <Button variant="secondary" onClick={refresh} disabled={isLoading}>
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="browse-groups-summary">
                <Typography color="text.secondary" variant="body2">
                  {isLoading
                    ? 'Refreshing recommended groups...'
                    : `${totalCount} recommended group${totalCount === 1 ? '' : 's'} available`}
                </Typography>
              </div>

              <div aria-busy={isLoading} className="browse-groups-grid">
                {isLoading
                  ? Array.from({ length: 6 }).map((_, index) => (
                      <GroupCardSkeleton key={index} />
                    ))
                  : recommendations.length > 0
                  ? recommendations.map((group) => (
                      <GroupCard
                        key={group.id}
                        groupId={group.id}
                        groupName={group.name}
                        description={group.description}
                        memberCount={group.memberCount}
                        contributionAmount={group.contributionAmount}
                        currency={group.currency}
                        status={group.status}
                        onJoin={group.status !== 'completed' ? () => setJoinGroup(group) : undefined}
                      />
                    ))
                  : (
                      <EmptyState
                        title={hasActiveFilters ? 'No groups found' : 'No recommendations yet'}
                        description={
                          hasActiveFilters
                            ? 'Try broadening your filters or search terms to discover more groups.'
                            : 'Refresh to update your personalized recommendations.'
                        }
                        className="browse-groups-empty"
                      />
                    )}
              </div>

              {!isLoading && recommendations.length > 0 && (
                <div ref={sentinelRef} className="browse-groups-sentinel" aria-hidden>
                  {hasMore ? (
                    <span>Loading more recommendations...</span>
                  ) : (
                    <p className="browse-groups-end-message">You’ve reached the end of recommended groups.</p>
                  )}
                </div>
              )}
            </section>
          )}
        </Stack>
      </AppCard>

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
        subtitle="Discover recommended groups based on your preferences and activity"
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
