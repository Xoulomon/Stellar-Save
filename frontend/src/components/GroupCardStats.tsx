import { formatDate } from '../utils/groupCardUtils';

interface GroupCardStatsProps {
  contributionAmount: string;
  memberCount: number;
  currentCycle: number;
  nextPayoutDate: Date | null | undefined;
}

export function GroupCardStats({
  contributionAmount,
  memberCount,
  currentCycle,
  nextPayoutDate,
}: GroupCardStatsProps) {
  return (
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
  );
}
