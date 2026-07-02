import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { buildRoute } from '../routing/constants';
import { fetchGroup } from '../utils/groupApi';
import type { GroupDetail } from '../types/group';
import { GroupBadge } from './GroupBadge';
import { usePrefetchGroup } from '../hooks/useGroup';

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
  description?: string;
  imageUrl?: string;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STROOPS_PER_XLM = 10_000_000;

function formatXlm(stroops: number): string {
  return (stroops / STROOPS_PER_XLM).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function computeNextPayout(
  startedAt: Date | null,
  currentCycle: number,
  cycleDurationSecs: number,
): Date | null {
  if (!startedAt || cycleDurationSecs <= 0) return null;
  const nextCycleEnd =
    startedAt.getTime() + (currentCycle + 1) * cycleDurationSecs * 1000;
  return new Date(nextCycleEnd);
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

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
  description,
  imageUrl,
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
      {imageUrl && (
        <div className="group-card-image">
          <img src={imageUrl} alt={groupName} />
        </div>
      )}

      <div className="group-card-header">
        <h3 className="group-card-title">{groupName}</h3>
        <GroupBadge status={status} />
      </div>

      {description && (
        <div className="group-card-description">
          <p>{description}</p>
        </div>
      )}

      <div className="group-card-body">
        <div className="group-card-stats">
          <div className="group-card-stat">
            <span className="group-card-stat-label">Contribution</span>
            <span className="group-card-stat-value">{contributionAmount}</span>
          </div>
          <div className="group-card-stat">
            <span className="group-card-stat-label">Members</span>
            <span className="group-card-stat-value">{memberCount}</span>
          </div>
          <div className="group-card-stat">
            <span className="group-card-stat-label">Cycle</span>
            <span className="group-card-stat-value">{currentCycle}</span>
          </div>
          <div className="group-card-stat">
            <span className="group-card-stat-label">Next Payout</span>
            <span className="group-card-stat-value group-card-stat-value--date">
              {formatDate(nextPayoutDate)}
            </span>
          </div>
        </div>
      </div>

      <div className="group-card-footer">
        {onViewDetails && (
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
          >
            View Details
          </Button>
        )}
        {onJoin && (
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onJoin(); }}
          >
            Join Group
          </Button>
        )}
      </div>
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
      {cardContent}
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

  // Fetch mode — React Query
  const { data, isLoading, error } = useQuery({
    queryKey: ['group', props.groupId],
    queryFn: () => fetchGroup(props.groupId!) as Promise<GroupDetail | null>,
    enabled: isFetchMode,
    staleTime: 30_000,
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
