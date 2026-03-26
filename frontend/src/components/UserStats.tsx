import './UserStats.css';

interface UserStatsProps {
  stats: {
    totalContributed: number;
    totalReceived: number;
    groupsJoined: number;
    activeGroups: number;
    completedCycles: number;
    averageContribution: number;
  };
  currency?: string;
  className?: string;
}

export function UserStats({
  stats,
  currency = 'XLM',
  className = '',
}: UserStatsProps) {
  return (
    <div className={`user-stats ${className}`}>
      <div className="user-stats-grid">
        <div className="stat-item">
          <div className="stat-label">Total Contributed</div>
          <div className="stat-value">
            {stats.totalContributed.toLocaleString()} {currency}
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-label">Total Received</div>
          <div className="stat-value">
            {stats.totalReceived.toLocaleString()} {currency}
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-label">Groups Joined</div>
          <div className="stat-value">{stats.groupsJoined}</div>
        </div>

        <div className="stat-item">
          <div className="stat-label">Active Groups</div>
          <div className="stat-value">{stats.activeGroups}</div>
        </div>

        <div className="stat-item">
          <div className="stat-label">Completed Cycles</div>
          <div className="stat-value">{stats.completedCycles}</div>
        </div>

        <div className="stat-item">
          <div className="stat-label">Avg. Contribution</div>
          <div className="stat-value">
            {stats.averageContribution.toLocaleString()} {currency}
          </div>
        </div>
      </div>
    </div>
  );
}