import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { GroupCardActions } from './GroupCardActions';
import { GroupCardHeader } from './GroupCardHeader';
import { GroupCardStats } from './GroupCardStats';
import { usePrefetchGroup } from '../hooks/useGroup';
import { STALE_TIME } from '../lib/queryClient';
import { buildRoute } from '../routing/constants';
import { fetchGroup } from '../utils/groupApi';
import { GroupCardSkeleton } from './Skeleton/GroupCardSkeleton';
import { queryKeys } from '../lib/queryKeys';
import { formatXlm, computeNextPayout } from '../utils/groupCardUtils';

import type { GroupDetail } from '../types/group';

type Status = 'active' | 'completed' | 'pending' | 'complete';

/** Prop-driven mode: caller supplies all data directly. */
interface GroupCardStaticProps {
  groupId?: string;
  groupName: string;
  description?: string;
  imageUrl?: string;
  memberCount: number;
  contributionAmount: number;
  currency?: string;
  status?: Status;
  currentCycle?: number;
  nextPayoutDate?: Date | null;
  onClick?: () => void;
  onViewDetails?: () => void;
  onJoin?: () => void;
  className?: string;
  ariaLabel?: string;
}

/** Fetch mode: only groupId is required; data is loaded via React Query. */
interface GroupCardFetchProps {
  groupId: string;
  groupName?: never;
  memberCount?: never;
  contributionAmount?: never;
  currency?: string;
  status?: never;
  currentCycle?: never;
  nextPayoutDate?: never;
  description?: never;
  imageUrl?: never;
  onClick?: () => void;
  onViewDetails?: () => void;
  onJoin?: () => void;
  className?: string;
  ariaLabel?: string;
}

export type GroupCardProps = GroupCardStaticProps | GroupCardFetchProps;

// ─── Inner UI ─────────────────────────────────────────────────────────────────

interface CardUIProps {
  groupId?: string;
  groupName: string;
  memberCount: number;
  contributionAmount: string;
  status: Status;
  currentCycle: number;
  nextPayoutDate: Date | null | undefined;
  description?: string;
  imageUrl?: string;
  onClick?: () => void;
  onViewDetails?: () => void;
  onJoin?: () => void;
  className?: string;
  ariaLabel?: string;
}

function GroupCardUI({
  groupId,
  groupName,
  description,
  imageUrl,
  memberCount,
  contributionAmount,
  status,
  currentCycle,
  nextPayoutDate,
  onClick,
  onViewDetails,
  onJoin,
  className = '',
  ariaLabel,
}: CardUIProps) {
  const classes = ['group-card', className].filter(Boolean).join(' ');
  const prefetchGroup = usePrefetchGroup();

  // Prefetch group detail data on hover so navigation feels instant
  const handleMouseEnter = () => {
    if (groupId) prefetchGroup(groupId);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    onClick?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  const cardLabel = ariaLabel || `Group ${groupName}`;

  const content = (
    <>
      <GroupCardHeader
        groupName={groupName}
        status={status}
        description={description}
        imageUrl={imageUrl}
      />
      <GroupCardStats
        contributionAmount={contributionAmount}
        memberCount={memberCount}
        currentCycle={currentCycle}
        nextPayoutDate={nextPayoutDate}
      />
      <GroupCardActions onViewDetails={onViewDetails} onJoin={onJoin} />
    </>
  );

  if (groupId) {
    return (
      <Link
        to={buildRoute.groupDetail(groupId)}
        className={classes}
        style={{ textDecoration: 'none', color: 'inherit' }}
        onClick={handleCardClick}
        onMouseEnter={handleMouseEnter}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={classes}
      onClick={handleCardClick}
      onMouseEnter={handleMouseEnter}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={handleKeyDown}
      aria-label={onClick ? cardLabel : undefined}
    >
      {content}
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

/**
 * GroupCard — displays group name, contribution amount, current cycle,
 * member count, next payout date, and a status badge.
 *
 * Two modes:
 * - **Static**: pass all data as props (backward-compatible with existing usage).
 * - **Fetch**: pass only `groupId`; data is fetched via React Query using the
 *   Soroban RPC client (`fetchGroup`). Shows a skeleton while loading and an
 *   inline error on failure.
 */
export function GroupCard(props: GroupCardProps) {
  const isFetchMode = props.groupId !== undefined && props.groupName === undefined;

  // Fetch mode — React Query. Uses the same cache key as `useGroup()` /
  // `usePrefetchGroup()` (queryKeys.groups.detail) so a hover-prefetch or a
  // GroupDetailPage render for the same group reuses this cache entry
  // instead of triggering a second network call.
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.groups.detail(props.groupId ?? ''),
    queryFn: () => fetchGroup(props.groupId!) as Promise<GroupDetail | null>,
    enabled: isFetchMode,
    staleTime: STALE_TIME.GROUP_STATE,
  });

  if (isFetchMode) {
    if (isLoading) return <GroupCardSkeleton />;

    if (error || !data) {
      return (
        <div className="group-card group-card--error" role="alert">
          <p className="group-card-error-msg">
            {error instanceof Error ? error.message : 'Failed to load group.'}
          </p>
        </div>
      );
    }

    const nextPayout = computeNextPayout(data.startedAt, data.currentCycle, data.cycleDuration);
    const amountStr = `${formatXlm(data.contributionAmount)} ${data.currency}`;

    return (
      <GroupCardUI
        groupId={data.id}
        groupName={data.name}
        memberCount={data.memberCount}
        contributionAmount={amountStr}
        status={data.status as Status}
        currentCycle={data.currentCycle}
        nextPayoutDate={nextPayout}
        description={data.description}
        imageUrl={data.imageUrl}
        onClick={props.onClick}
        onViewDetails={props.onViewDetails}
        onJoin={props.onJoin}
        className={props.className}
        ariaLabel={props.ariaLabel}
      />
    );
  }

  // Static mode — props supplied directly (backward-compatible)
  const p = props as GroupCardStaticProps;
  const amountStr = `${(p.contributionAmount ?? 0).toLocaleString()} ${p.currency ?? 'XLM'}`;

  return (
    <GroupCardUI
      groupId={p.groupId}
      groupName={p.groupName}
      memberCount={p.memberCount}
      contributionAmount={amountStr}
      status={p.status ?? 'active'}
      currentCycle={p.currentCycle ?? 0}
      nextPayoutDate={p.nextPayoutDate}
      description={p.description}
      imageUrl={p.imageUrl}
      onClick={p.onClick}
      onViewDetails={p.onViewDetails}
      onJoin={p.onJoin}
      className={p.className}
      ariaLabel={p.ariaLabel}
    />
  );
}
