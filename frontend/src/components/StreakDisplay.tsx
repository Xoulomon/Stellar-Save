import "./StreakDisplay.css";

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

export interface StreakDisplayProps {
  currentStreak: number;
  longestStreak: number;
  /** Warn when streak is at risk (e.g. contribution due soon) */
  atRisk?: boolean;
}

export function StreakDisplay({
  currentStreak,
  longestStreak,
  atRisk = false,
}: StreakDisplayProps) {
  const earnedBadges = getEarnedBadges(currentStreak);
  const nextMilestone = getNextMilestone(currentStreak);
  const progressToNext = nextMilestone
    ? Math.round((currentStreak / nextMilestone.threshold) * 100)
    : 100;

  return (
    <div
      className={`streak-display${atRisk ? " streak-display--at-risk" : ""}`}
      data-testid="streak-display"
    >
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
    </div>
  );
}
