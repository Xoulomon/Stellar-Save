/**
 * ActivityFeed
 *
 * Real-time activity feed showing contributions, payouts, and member joins.
 * Supports infinite scroll for older events and filtering by activity type.
 */

import { useCallback, useEffect, useRef } from 'react';
import { Skeleton } from '../Skeleton/Skeleton';
import { EmptyState } from '../EmptyState/EmptyState';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import type { ActivityItem, ActivityFeedFilter } from '../../hooks/useActivityFeed';
import type { AppEvent, EventType } from '../../types/events';
import './ActivityFeed.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActivityFeedProps {
  /** Scope the feed to a single group */
  groupId?: bigint;
  /** Initial type filter */
  defaultFilter?: EventType[];
  /** Max height before scrolling (default: 600px) */
  maxHeight?: string;
  /** Show the filter toolbar (default: true) */
  showFilters?: boolean;
  /** Show the refresh button (default: true) */
  showRefresh?: boolean;
  className?: string;
}

// ─── Inline SVG icons (no @mui/icons-material dependency) ───────────────────

const IconContribution = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" />
  </svg>
);

const IconPayout = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
  </svg>
);

const IconMemberJoin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

const IconGroupCreated = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
);

const IconRefresh = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
  </svg>
);

const IconFilter = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
  </svg>
);

const FILTER_OPTIONS: { label: string; value: EventType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Contributions', value: 'ContributionMade' },
  { label: 'Payouts', value: 'PayoutExecuted' },
  { label: 'Members', value: 'MemberJoined' },
  { label: 'Groups', value: 'GroupCreated' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(ms: number): string {
  const diffMs = Date.now() - ms;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 10) return 'Just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

function formatXlm(stroops: bigint): string {
  const xlm = Number(stroops) / 10_000_000;
  return `${xlm.toLocaleString('en-US', { maximumFractionDigits: 2 })} XLM`;
}

function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// ─── Activity item renderer ───────────────────────────────────────────────────

interface ActivityItemConfig {
  icon: React.ReactNode;
  colorClass: string;
  title: string;
  subtitle?: string;
}

function getItemConfig(event: AppEvent): ActivityItemConfig {
  switch (event.type) {
    case 'ContributionMade':
      return {
        icon: <IconContribution />,
        colorClass: 'activity-item--contribution',
        title: `${shortenAddress(event.contributor)} contributed`,
        subtitle: `${formatXlm(event.amount)} · Cycle ${event.cycle}`,
      };
    case 'PayoutExecuted':
      return {
        icon: <IconPayout />,
        colorClass: 'activity-item--payout',
        title: `${shortenAddress(event.recipient)} received payout`,
        subtitle: `${formatXlm(event.amount)} · Cycle ${event.cycle}`,
      };
    case 'MemberJoined':
      return {
        icon: <IconMemberJoin />,
        colorClass: 'activity-item--member-join',
        title: `${shortenAddress(event.member)} joined`,
        subtitle: `${event.memberCount} member${event.memberCount !== 1 ? 's' : ''} total`,
      };
    case 'GroupCreated':
      return {
        icon: <IconGroupCreated />,
        colorClass: 'activity-item--group-created',
        title: `Group #${event.groupId} created`,
        subtitle: `by ${shortenAddress(event.creator)} · max ${event.maxMembers} members`,
      };
    default:
      return {
        icon: null,
        colorClass: '',
        title: 'Activity',
      };
  }
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function ActivityItemSkeleton() {
  return (
    <div className="activity-item activity-item--skeleton" aria-hidden>
      <div className="activity-item__icon-wrap">
        <Skeleton variant="circle" width={32} height={32} />
      </div>
      <div className="activity-item__body">
        <Skeleton variant="text" width="60%" height={14} />
        <Skeleton variant="text" width="40%" height={12} style={{ marginTop: 4 }} />
      </div>
      <Skeleton variant="text" width={48} height={12} />
    </div>
  );
}

// ─── Single activity row ──────────────────────────────────────────────────────

interface ActivityRowProps {
  item: ActivityItem;
}

function ActivityRow({ item }: ActivityRowProps) {
  const config = getItemConfig(item.event);

  return (
    <li className={`activity-item ${config.colorClass}`}>
      <div className="activity-item__icon-wrap" aria-hidden>
        {config.icon}
      </div>
      <div className="activity-item__body">
        <span className="activity-item__title">{config.title}</span>
        {config.subtitle && (
          <span className="activity-item__subtitle">{config.subtitle}</span>
        )}
      </div>
      <time
        className="activity-item__time"
        dateTime={new Date(item.timestampMs).toISOString()}
        title={new Date(item.timestampMs).toLocaleString()}
      >
        {formatRelativeTime(item.timestampMs)}
      </time>
    </li>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ActivityFeed({
  groupId,
  defaultFilter,
  maxHeight = '600px',
  showFilters = true,
  showRefresh = true,
  className = '',
}: ActivityFeedProps) {
  const {
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    setFilter,
    activeFilter,
  } = useActivityFeed({
    filter: { groupId, types: defaultFilter },
    liveUpdates: true,
  });

  // ── Infinite scroll sentinel ───────────────────────────────────────────────
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMore, items]);

  // ── Filter change ──────────────────────────────────────────────────────────
  const handleFilterChange = useCallback(
    (value: EventType | 'all') => {
      const newFilter: ActivityFeedFilter = {
        groupId,
        types: value === 'all' ? undefined : [value],
      };
      setFilter(newFilter);
    },
    [groupId, setFilter],
  );

  const activeType: EventType | 'all' =
    activeFilter.types && activeFilter.types.length === 1
      ? activeFilter.types[0]!
      : 'all';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section
      className={['activity-feed', className].filter(Boolean).join(' ')}
      aria-label="Activity feed"
    >
      {/* Header */}
      <div className="activity-feed__header">
        <h3 className="activity-feed__title">Activity</h3>
        {showRefresh && (
          <button
            type="button"
            className="activity-feed__refresh-btn"
            onClick={refresh}
            disabled={isLoading}
            aria-label="Refresh activity feed"
          >
            <IconRefresh />
          </button>
        )}
      </div>

      {/* Filter toolbar */}
      {showFilters && (
        <div className="activity-feed__filters" role="group" aria-label="Filter by activity type">
          <IconFilter className="activity-feed__filter-icon" aria-hidden />
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={[
                'activity-feed__filter-btn',
                activeType === opt.value ? 'activity-feed__filter-btn--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleFilterChange(opt.value)}
              aria-pressed={activeType === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="activity-feed__error" role="alert">
          {error}
          <button
            type="button"
            className="activity-feed__error-retry"
            onClick={refresh}
          >
            Retry
          </button>
        </div>
      )}

      {/* Feed list */}
      <div
        className="activity-feed__scroll-area"
        style={{ maxHeight }}
        role="feed"
        aria-busy={isLoading}
        aria-label="Recent activity"
      >
        {isLoading ? (
          <ul className="activity-feed__list" aria-label="Loading activity">
            {Array.from({ length: 5 }).map((_, i) => (
              <ActivityItemSkeleton key={i} />
            ))}
          </ul>
        ) : items.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Contributions, payouts, and member joins will appear here."
            className="activity-feed__empty"
          />
        ) : (
          <ul className="activity-feed__list">
            {items.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </ul>
        )}

        {/* Infinite scroll sentinel */}
        {!isLoading && items.length > 0 && (
          <div ref={sentinelRef} className="activity-feed__sentinel" aria-hidden>
            {isLoadingMore && (
              <ul className="activity-feed__list" aria-label="Loading more">
                {Array.from({ length: 3 }).map((_, i) => (
                  <ActivityItemSkeleton key={i} />
                ))}
              </ul>
            )}
            {!hasMore && items.length > 0 && (
              <p className="activity-feed__end-message">All caught up</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default ActivityFeed;
