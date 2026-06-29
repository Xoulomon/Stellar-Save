import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import "./StreakDisplay.css";
import {
  fetchReferralRewards,
  claimReferralRewards,
  stroopsToXlm,
} from '../utils/referralApi';

// ── Badge definitions ─────────────────────────────────────────────────────────

export interface StreakBadge {
  threshold: number;
  label: string;
  icon: string;
}

export const STREAK_BADGES: StreakBadge[] = [
  { threshold: 5, label: "Starter", icon: "🌱" },
  { threshold: 10, label: "Consistent", icon: "🔥" },
  { threshold: 20, label: "Dedicated", icon: "⚡" },
  { threshold: 50, label: "Legend", icon: "🏆" },
];

export function getEarnedBadges(streak: number): StreakBadge[] {
  return STREAK_BADGES.filter((b) => streak >= b.threshold);
}

export function getNextMilestone(streak: number): StreakBadge | null {
  return STREAK_BADGES.find((b) => streak < b.threshold) ?? null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StreakDisplayProps {
  currentStreak: number;
  longestStreak: number;
  /** Warn when streak is at risk (e.g. contribution due soon) */
  atRisk?: boolean;
  /** Connected wallet address — required to load referral rewards */
  address?: string;
}

// ── Celebration overlay ───────────────────────────────────────────────────────

function CelebrationBurst({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="streak-celebration" aria-hidden="true">
      {['✨', '🎉', '⭐', '🌟', '✨'].map((emoji, i) => (
        <span key={i} className="streak-celebration-particle" style={{ '--i': i } as React.CSSProperties}>
          {emoji}
        </span>
      ))}
    </div>
  );
}

// ── Referral rewards section ──────────────────────────────────────────────────

function ReferralRewardsSection({ address }: { address: string }) {
  const [claimSuccess, setClaimSuccess] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['referralRewards', address],
    queryFn: () => fetchReferralRewards(address),
    staleTime: 30_000,
  });

  const claimMutation = useMutation({
    mutationFn: () => claimReferralRewards(address),
    onSuccess: () => {
      setClaimSuccess(true);
      setTimeout(() => setClaimSuccess(false), 4000);
      refetch();
    },
  });

  if (isLoading) {
    return <div className="streak-referral-loading">Loading referral rewards…</div>;
  }

  if (!data) return null;

  const pending = stroopsToXlm(data.pendingBalance);
  const claimed = stroopsToXlm(data.totalClaimed);
  const hasPending = data.pendingBalance > 0n;

  return (
    <div className="streak-referral" data-testid="referral-rewards">
      <h4 className="streak-referral-title">Referral Rewards</h4>
      <div className="streak-referral-stats">
        <div className="streak-referral-stat">
          <span className="streak-referral-value">{pending} XLM</span>
          <span className="streak-referral-label">Pending</span>
        </div>
        <div className="streak-referral-stat">
          <span className="streak-referral-value">{data.referralCount}</span>
          <span className="streak-referral-label">Referrals</span>
        </div>
        <div className="streak-referral-stat">
          <span className="streak-referral-value">{claimed} XLM</span>
          <span className="streak-referral-label">Total Claimed</span>
        </div>
      </div>

      {claimSuccess && (
        <div className="streak-referral-success" role="status">
          Rewards claimed successfully!
        </div>
      )}
      {claimMutation.isError && (
        <div className="streak-referral-error" role="alert">
          {(claimMutation.error as Error).message}
        </div>
      )}

      <button
        className="streak-referral-claim-btn"
        onClick={() => claimMutation.mutate()}
        disabled={!hasPending || claimMutation.isPending}
        aria-busy={claimMutation.isPending}
        data-testid="claim-referral-btn"
      >
        {claimMutation.isPending ? 'Claiming…' : `Claim ${pending} XLM`}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function StreakDisplay({
  currentStreak,
  longestStreak,
  atRisk = false,
  address,
}: StreakDisplayProps) {
  const earnedBadges = getEarnedBadges(currentStreak);
  const nextMilestone = getNextMilestone(currentStreak);
  const progressToNext = nextMilestone
    ? Math.round((currentStreak / nextMilestone.threshold) * 100)
    : 100;

  // Track whether a new milestone was just crossed to fire the celebration.
  const prevStreakRef = useRef(currentStreak);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    const prevBadges = getEarnedBadges(prevStreakRef.current).length;
    const nowBadges = earnedBadges.length;
    if (nowBadges > prevBadges) {
      setCelebrating(true);
      const t = setTimeout(() => setCelebrating(false), 2000);
      prevStreakRef.current = currentStreak;
      return () => clearTimeout(t);
    }
    prevStreakRef.current = currentStreak;
  }, [currentStreak, earnedBadges.length]);

  return (
    <div
      className={`streak-display${atRisk ? " streak-display--at-risk" : ""}${celebrating ? " streak-display--celebrating" : ""}`}
      data-testid="streak-display"
    >
      <CelebrationBurst active={celebrating} />

      {atRisk && (
        <div className="streak-warning" role="alert" data-testid="streak-warning">
          ⚠️ Your streak is at risk! Contribute before the deadline to keep it.
        </div>
      )}

      <div className="streak-stats">
        <div className="streak-stat" data-testid="current-streak">
          <span className="streak-stat-value">{currentStreak}</span>
          <span className="streak-stat-label">Current Streak</span>
        </div>
        <div className="streak-stat" data-testid="longest-streak">
          <span className="streak-stat-value">{longestStreak}</span>
          <span className="streak-stat-label">Longest Streak</span>
        </div>
      </div>

      {nextMilestone && (
        <div className="streak-progress" data-testid="streak-progress">
          <div className="streak-progress-header">
            <span>
              Next: {nextMilestone.icon} {nextMilestone.label} ({nextMilestone.threshold})
            </span>
            <span className="streak-progress-pct">{progressToNext}%</span>
          </div>
          <div
            className="streak-progress-bar"
            role="progressbar"
            aria-valuenow={currentStreak}
            aria-valuemin={0}
            aria-valuemax={nextMilestone.threshold}
            aria-label={`Progress to ${nextMilestone.label} badge`}
          >
            <div
              className="streak-progress-fill"
              style={{ width: `${progressToNext}%` }}
            />
          </div>
          <span className="streak-progress-sub">
            {currentStreak} / {nextMilestone.threshold} contributions
          </span>
        </div>
      )}

      {earnedBadges.length > 0 && (
        <div className="streak-badges" data-testid="streak-badges">
          <h4 className="streak-badges-title">Earned Badges</h4>
          <ul className="streak-badges-list" aria-label="Earned badges">
            {earnedBadges.map((badge) => (
              <li
                key={badge.threshold}
                className="streak-badge"
                data-testid={`badge-${badge.threshold}`}
                title={`${badge.label} — ${badge.threshold} contributions`}
              >
                <span className="streak-badge-icon" aria-hidden="true">
                  {badge.icon}
                </span>
                <span className="streak-badge-label">{badge.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {earnedBadges.length === 0 && (
        <p className="streak-no-badges" data-testid="no-badges">
          Keep contributing to earn your first badge at 5 contributions!
        </p>
      )}

      {address && (
        <>
          <div className="streak-divider" aria-hidden="true" />
          <ReferralRewardsSection address={address} />
        </>
      )}
    </div>
  );
}
