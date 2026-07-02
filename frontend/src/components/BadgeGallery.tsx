import React, { useCallback } from 'react';
import type { MemberBadge } from '../hooks/useMemberBadges';
import './BadgeGallery.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BadgeGalleryProps {
  /** Ordered list of earned badges to display */
  badges: MemberBadge[];
  /** Loading state — shows skeleton cards when true */
  isLoading?: boolean;
  /** Error message to display instead of the grid */
  error?: string | null;
  /** Wallet address owning these badges (used for share URL) */
  walletAddress?: string;
  /** Optional section title override */
  title?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatEarnedDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function buildShareText(badge: MemberBadge, walletAddress?: string): string {
  const base = `I earned the "${badge.name}" badge on Stellar Save! ${badge.artwork}`;
  if (walletAddress) {
    return `${base}\nhttps://stellar-save.app/members/${walletAddress}`;
  }
  return base;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function BadgeSkeletons({ count = 6 }: { count?: number }) {
  return (
    <div className="badge-gallery__loading" aria-busy="true" aria-label="Loading badges…">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="badge-gallery__skeleton" role="presentation" />
      ))}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function BadgeGalleryEmpty() {
  return (
    <div
      className="badge-gallery__empty"
      role="status"
      aria-label="No badges earned yet"
    >
      <span className="badge-gallery__empty-icon" aria-hidden="true">🎖️</span>
      <p className="badge-gallery__empty-title">No badges yet</p>
      <p className="badge-gallery__empty-body">
        Contribute consistently, complete cycles, and earn payouts to unlock
        soulbound badges on-chain.
      </p>
    </div>
  );
}

// ── Individual badge card ─────────────────────────────────────────────────────

interface BadgeCardProps {
  badge: MemberBadge;
  walletAddress?: string;
}

function BadgeCard({ badge, walletAddress }: BadgeCardProps) {
  const handleShare = useCallback(() => {
    const text = buildShareText(badge, walletAddress);

    if (typeof navigator !== 'undefined' && navigator.share) {
      // Native share sheet (mobile / Safari 15+)
      navigator.share({ text }).catch(() => {
        // User cancelled — not an error
      });
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => undefined);
    }
  }, [badge, walletAddress]);

  return (
    <li
      className="badge-gallery__card"
      tabIndex={0}
      aria-label={`Badge: ${badge.name}. Earned ${formatEarnedDate(badge.earnedAt)}. ${badge.description}`}
      role="listitem"
    >
      <button
        className="badge-gallery__share"
        onClick={handleShare}
        aria-label={`Share ${badge.name} badge`}
        type="button"
      >
        Share
      </button>

      <span
        className="badge-gallery__artwork"
        aria-hidden="true"
        role="img"
      >
        {badge.artwork}
      </span>

      <p className="badge-gallery__name">{badge.name}</p>

      <time
        className="badge-gallery__date"
        dateTime={new Date(badge.earnedAt).toISOString()}
        aria-label={`Earned on ${formatEarnedDate(badge.earnedAt)}`}
      >
        {formatEarnedDate(badge.earnedAt)}
      </time>
    </li>
  );
}

// ── BadgeGallery ──────────────────────────────────────────────────────────────

/**
 * BadgeGallery
 *
 * Displays a responsive grid of soulbound on-chain badges earned by a member.
 * Shows skeleton cards while loading, an empty state when the wallet has no
 * badges, and a share affordance on each individual badge card.
 *
 * @example
 * ```tsx
 * const { badges, isLoading, error } = useMemberBadges(address);
 * <BadgeGallery badges={badges} isLoading={isLoading} error={error} walletAddress={address} />
 * ```
 */
export function BadgeGallery({
  badges,
  isLoading = false,
  error = null,
  walletAddress,
  title = 'Soulbound Badges',
}: BadgeGalleryProps) {
  return (
    <section className="badge-gallery" aria-labelledby="badge-gallery-heading">
      <div className="badge-gallery__header">
        <h3 id="badge-gallery-heading" style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>
          {title}
        </h3>
        {!isLoading && !error && badges.length > 0 && (
          <span className="badge-gallery__count" aria-live="polite">
            {badges.length} badge{badges.length !== 1 ? 's' : ''} earned
          </span>
        )}
      </div>

      {isLoading && <BadgeSkeletons count={6} />}

      {!isLoading && error && (
        <p role="alert" style={{ color: '#d32f2f', fontSize: '0.85rem', margin: 0 }}>
          {error}
        </p>
      )}

      {!isLoading && !error && badges.length === 0 && <BadgeGalleryEmpty />}

      {!isLoading && !error && badges.length > 0 && (
        <ol className="badge-gallery__grid" aria-label={`${badges.length} earned badges`}>
          {badges.map((badge) => (
            <BadgeCard key={badge.id} badge={badge} walletAddress={walletAddress} />
          ))}
        </ol>
      )}
    </section>
  );
}

export default BadgeGallery;
