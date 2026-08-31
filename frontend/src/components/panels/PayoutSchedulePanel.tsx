import { formatAmount, formatDateRange } from '../../utils/format';
import { Badge } from '../Badge';
import { Card } from '../Card';

import type { GroupCycle } from '../../utils/groupApi';

interface PayoutSchedulePanelProps {
  cycles: GroupCycle[];
  currentCycle?: GroupCycle;
}

export function PayoutSchedulePanel({ cycles, currentCycle }: PayoutSchedulePanelProps) {
  const getStatusVariant = (status: string): 'success' | 'warning' | 'info' | 'danger' => {
    switch (status) {
      case 'active':
      case 'completed':
        return 'success';
      case 'pending':
        return 'info';
      case 'upcoming':
        return 'warning';
      default:
        return 'info';
    }
  };

  return (
    <div className="group-details-cycles">
      {currentCycle && (
        <Card variant="elevated" className="group-details-current-cycle">
          <div className="group-details-cycle-header">
            <h4>Current Cycle #{currentCycle.cycleNumber}</h4>
            <Badge variant={getStatusVariant(currentCycle.status)} size="sm">
              {currentCycle.status}
            </Badge>
          </div>
          <div className="group-details-cycle-dates">
            <span>
              {formatDateRange(currentCycle.startDate, currentCycle.endDate)}
            </span>
          </div>
          <div className="group-details-cycle-progress">
            <div className="group-details-progress-bar">
              <div
                className="group-details-progress-fill"
                style={{
                  width: `${Math.min((currentCycle.currentAmount / currentCycle.targetAmount) * 100, 100)}%`,
                }}
              />
            </div>
            <span className="group-details-cycle-amount">
              {formatAmount(currentCycle.currentAmount)} / {formatAmount(currentCycle.targetAmount)}
            </span>
          </div>
        </Card>
      )}

      <div className="group-details-cycle-history">
        <h4>Cycle History</h4>
        <div className="group-details-cycle-list">
          {cycles.map((cycle) => (
            <div key={cycle.cycleNumber} className="group-details-cycle-item">
              <div className="group-details-cycle-item-header">
                <span className="group-details-cycle-number">Cycle #{cycle.cycleNumber}</span>
                <Badge variant={getStatusVariant(cycle.status)} size="sm">
                  {cycle.status}
                </Badge>
              </div>
              <div className="group-details-cycle-item-dates">
                {formatDateRange(cycle.startDate, cycle.endDate)}
              </div>
              <div className="group-details-cycle-item-amount">
                {formatAmount(cycle.currentAmount)} / {formatAmount(cycle.targetAmount)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
