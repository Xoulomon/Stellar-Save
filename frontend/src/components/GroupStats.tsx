import './GroupStats.css';
import { Card } from './Card';

interface GroupStatsProps {
  totalContributed: number;
  totalPaidOut: number;
  totalExpected: number;
  currency?: string;
  className?: string;
}

export function GroupStats({
  totalContributed,
  totalPaidOut,
  totalExpected,
  currency = 'XLM',
  className = '',
}: GroupStatsProps) {
  const completionPercentage = totalExpected > 0 
    ? Math.round((totalContributed / totalExpected) * 100) 
    : 0;

  const payoutPercentage = totalContributed > 0
    ? Math.round((totalPaidOut / totalContributed) * 100)
    : 0;

  return (
    <Card className={`group-stats ${className}`} variant="elevated">
      <div className="group-stats-grid">
        <div className="stat-item">
          <div className="stat-label">Total Contributed</div>
          <div className="stat-value">
            {totalContributed.toLocaleString()} {currency}
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-label">Total Paid Out</div>
          <div className="stat-value">
            {totalPaidOut.toLocaleString()} {currency}
          </div>
        </div>

        <div className="stat-item stat-item-full">
          <div className="stat-label">Completion Progress</div>
          <div className="stat-value">{completionPercentage}%</div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <div className="progress-label">
            {totalContributed.toLocaleString()} / {totalExpected.toLocaleString()} {currency}
          </div>
        </div>

        <div className="stat-item stat-item-full">
          <div className="stat-label">Payout Progress</div>
          <div className="stat-value">{payoutPercentage}%</div>
          <div className="progress-bar">
            <div 
              className="progress-fill progress-fill-secondary" 
              style={{ width: `${payoutPercentage}%` }}
            />
          </div>
          <div className="progress-label">
            {totalPaidOut.toLocaleString()} / {totalContributed.toLocaleString()} {currency}
          </div>
        </div>
      </div>
    </Card>
  );
}
