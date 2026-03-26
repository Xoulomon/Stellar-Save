import { useMemo } from 'react';
import { Badge } from './Badge';
import { calculateCycleProgressFromDeadline, type CycleProgressResult } from '../utils';
import './CycleProgress.css';

export interface CycleProgressProps {
  cycleNumber: number;
  deadline: Date;
  contributedCount: number;
  totalMembers: number;
  targetAmount: number;
  currentAmount?: number;
  status?: 'active' | 'completed' | 'pending';
}

type CycleProgressType = CycleProgressResult;

export function CycleProgress({
  cycleNumber,
  deadline,
  contributedCount,
  totalMembers,
  targetAmount,
  currentAmount = 0,
  status = 'active',
}: CycleProgressProps) {
  const cycleProgress = useMemo((): CycleProgressType => {
    return calculateCycleProgressFromDeadline(deadline, contributedCount, totalMembers);
  }, [deadline, contributedCount, totalMembers]);

  const timeRemaining = cycleProgress.timeRemaining ?? 'Ended';
  const contributionProgress = cycleProgress.contributionProgress;
  const amountProgress = (currentAmount / targetAmount) * 100;
  const isOverdue = cycleProgress.isOverdue;

  return (
    <div className={`cycle-progress cycle-progress--${status}`}>
      <div className="cycle-progress-header">
        <div className="cycle-progress-title">
          <h3>Cycle {cycleNumber}</h3>
          <Badge variant={status === 'completed' ? 'success' : status === 'pending' ? 'warning' : 'info'}>
            {status}
          </Badge>
        </div>
        <div className={`cycle-progress-time ${isOverdue ? 'overdue' : ''}`}>
          <span className="time-label">Time Remaining:</span>
          <span className="time-value">{timeRemaining}</span>
        </div>
      </div>

      <div className="cycle-progress-stats">
        <div className="stat">
          <span className="stat-label">Contributions</span>
          <span className="stat-value">{contributedCount}/{totalMembers}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Amount</span>
          <span className="stat-value">{currentAmount.toLocaleString()} XLM</span>
        </div>
        <div className="stat">
          <span className="stat-label">Target</span>
          <span className="stat-value">{targetAmount.toLocaleString()} XLM</span>
        </div>
      </div>

      <div className="cycle-progress-bars">
        <div className="progress-item">
          <div className="progress-header">
            <span>Contribution Progress</span>
            <span className="progress-percentage">{contributionProgress.toFixed(0)}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${Math.min(contributionProgress, 100)}%` }}
            />
          </div>
        </div>

        <div className="progress-item">
          <div className="progress-header">
            <span>Amount Progress</span>
            <span className="progress-percentage">{amountProgress.toFixed(0)}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill progress-fill--amount" 
              style={{ width: `${Math.min(amountProgress, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {cycleProgress.isComplete && (
        <div className="cycle-progress-complete">
          ✓ Cycle complete
        </div>
      )}
    </div>
  );
}
