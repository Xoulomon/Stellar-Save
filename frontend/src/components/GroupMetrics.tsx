import './GroupMetrics.css';
import { Card } from './Card';
import type { DetailedGroup, GroupContribution, GroupCycle } from '../utils/groupApi';

type Trend = 'improving' | 'declining';

interface GroupMetricsProps {
  group: DetailedGroup;
  contributions: GroupContribution[];
  cycles: GroupCycle[];
  className?: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getCompletionRate(contributions: GroupContribution[]) {
  if (contributions.length === 0) return 0;
  const completedCount = contributions.filter((item) => item.status === 'completed').length;
  return Math.round((completedCount / contributions.length) * 100);
}

function getAverageContributionTimeHours(contributions: GroupContribution[]) {
  const completed = contributions
    .filter((item) => item.status === 'completed')
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  if (completed.length < 2) {
    return 0;
  }

  const intervals: number[] = [];
  for (let i = 1; i < completed.length; i += 1) {
    const previous = completed[i - 1].timestamp.getTime();
    const current = completed[i].timestamp.getTime();
    intervals.push((current - previous) / (1000 * 60 * 60));
  }

  const total = intervals.reduce((sum, value) => sum + value, 0);
  return total / intervals.length;
}

function getCompletionTrend(cycles: GroupCycle[]): Trend {
  if (cycles.length < 2) return 'improving';

  const sorted = [...cycles].sort((a, b) => a.cycleNumber - b.cycleNumber);
  const previousCycle = sorted[sorted.length - 2];
  const latestCycle = sorted[sorted.length - 1];

  const previousCompletion =
    previousCycle.targetAmount > 0
      ? (previousCycle.currentAmount / previousCycle.targetAmount) * 100
      : 0;
  const latestCompletion =
    latestCycle.targetAmount > 0 ? (latestCycle.currentAmount / latestCycle.targetAmount) * 100 : 0;

  return latestCompletion >= previousCompletion ? 'improving' : 'declining';
}

function getActivityTrend(contributions: GroupContribution[]): Trend {
  if (contributions.length < 2) return 'improving';

  const sorted = [...contributions].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const latestTimestamp = sorted[sorted.length - 1].timestamp.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const recentWindowStart = latestTimestamp - sevenDaysMs;
  const previousWindowStart = recentWindowStart - sevenDaysMs;

  const recentCount = sorted.filter((item) => item.timestamp.getTime() >= recentWindowStart).length;
  const previousCount = sorted.filter((item) => {
    const time = item.timestamp.getTime();
    return time >= previousWindowStart && time < recentWindowStart;
  }).length;

  return recentCount >= previousCount ? 'improving' : 'declining';
}

function getAverageCycleCompletion(cycles: GroupCycle[]) {
  if (cycles.length === 0) return 0;
  const totalCompletion = cycles.reduce((sum, cycle) => {
    if (cycle.targetAmount <= 0) return sum;
    return sum + Math.min((cycle.currentAmount / cycle.targetAmount) * 100, 100);
  }, 0);
  return totalCompletion / cycles.length;
}

function getHealthScore(
  completionRate: number,
  averageCycleCompletion: number,
  activityTrend: Trend,
  groupProgress: number
) {
  const activityBonus = activityTrend === 'improving' ? 10 : 0;
  return Math.round(
    clamp(
      completionRate * 0.5 + averageCycleCompletion * 0.2 + groupProgress * 0.2 + activityBonus,
      0,
      100
    )
  );
}

function formatAverageContributionTime(hours: number) {
  if (hours <= 0) return '0 hours';
  if (hours >= 24) {
    return `${(hours / 24).toFixed(1)} days`;
  }
  return `${hours.toFixed(1)} hours`;
}

function getTrendLabel(trend: Trend) {
  return trend === 'improving' ? 'Improving' : 'Declining';
}

export function GroupMetrics({ group, contributions, cycles, className = '' }: GroupMetricsProps) {
  const completionRate = getCompletionRate(contributions);
  const averageContributionTimeHours = getAverageContributionTimeHours(contributions);
  const completionTrend = getCompletionTrend(cycles);
  const activityTrend = getActivityTrend(contributions);
  const averageCycleCompletion = getAverageCycleCompletion(cycles);
  const groupProgress =
    group.targetAmount > 0 ? Math.min((group.currentAmount / group.targetAmount) * 100, 100) : 0;
  const healthScore = getHealthScore(
    completionRate,
    averageCycleCompletion,
    activityTrend,
    groupProgress
  );
  const healthTrend: Trend =
    completionTrend === 'improving' && activityTrend === 'improving' ? 'improving' : 'declining';

  return (
    <Card className={`group-metrics ${className}`} variant="elevated">
      <div className="group-metrics-header">
        <h4>Performance Metrics</h4>
      </div>

      <div className="group-metrics-grid">
        <div className="group-metric-item">
          <div className="group-metric-label">Contribution Completion Rate</div>
          <div className="group-metric-value" data-testid="completion-rate-value">
            {completionRate}%
          </div>
          <div className={`group-metric-trend group-metric-trend-${completionTrend}`}>
            {getTrendLabel(completionTrend)}
          </div>
        </div>

        <div className="group-metric-item">
          <div className="group-metric-label">Average Contribution Time</div>
          <div className="group-metric-value" data-testid="average-time-value">
            {formatAverageContributionTime(averageContributionTimeHours)}
          </div>
          <div className={`group-metric-trend group-metric-trend-${activityTrend}`}>
            {getTrendLabel(activityTrend)}
          </div>
        </div>

        <div className="group-metric-item">
          <div className="group-metric-label">Group Health Score</div>
          <div className="group-metric-value" data-testid="health-score-value">
            {healthScore}/100
          </div>
          <div className={`group-metric-trend group-metric-trend-${healthTrend}`}>
            {getTrendLabel(healthTrend)}
          </div>
        </div>
      </div>
    </Card>
  );
}
