import { useState } from 'react';
import './GroupDetails.css';
import { Card } from './Card';
import { Badge } from './Badge';
import { Avatar } from './Avatar';
import { Tabs, type Tab } from './Tabs';

export interface GroupMember {
  id: string;
  address: string;
  name?: string;
  joinedAt: Date;
  totalContributions: number;
  isActive: boolean;
}

export interface Contribution {
  id: string;
  memberId: string;
  memberName?: string;
  amount: number;
  timestamp: Date;
  transactionHash: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface CycleInfo {
  cycleNumber: number;
  startDate: Date;
  endDate: Date;
  targetAmount: number;
  currentAmount: number;
  status: 'active' | 'completed' | 'upcoming';
}

export interface GroupInfo {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  totalMembers: number;
  targetAmount: number;
  currentAmount: number;
  contributionFrequency: 'daily' | 'weekly' | 'monthly';
  status: 'active' | 'paused' | 'completed';
}

interface GroupDetailsProps {
  group: GroupInfo;
  members: GroupMember[];
  contributions: Contribution[];
  cycles: CycleInfo[];
  currentCycle?: CycleInfo;
  onMemberClick?: (member: GroupMember) => void;
  onContributionClick?: (contribution: Contribution) => void;
  className?: string;
}

export function GroupDetails({
  group,
  members,
  contributions,
  cycles,
  currentCycle,
  onMemberClick,
  onContributionClick,
  className = '',
}: GroupDetailsProps) {
  const [selectedTab, setSelectedTab] = useState<string>('overview');

  // Calculate progress percentage
  const progressPercentage = group.targetAmount > 0
    ? Math.min((group.currentAmount / group.targetAmount) * 100, 100)
    : 0;

  // Format currency
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Format date
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  // Get status badge variant
  const getStatusVariant = (status: string): 'success' | 'warning' | 'info' | 'danger' => {
    switch (status) {
      case 'active':
      case 'completed':
        return 'success';
      case 'paused':
        return 'warning';
      case 'pending':
        return 'info';
      case 'failed':
        return 'danger';
      default:
        return 'info';
    }
  };

  // Overview Tab Content
  const overviewContent = (
    <div className="group-details-overview">
      <div className="group-details-info-grid">
        <div className="group-details-info-item">
          <span className="group-details-info-label">Created</span>
          <span className="group-details-info-value">{formatDate(group.createdAt)}</span>
        </div>
        <div className="group-details-info-item">
          <span className="group-details-info-label">Members</span>
          <span className="group-details-info-value">{group.totalMembers}</span>
        </div>
        <div className="group-details-info-item">
          <span className="group-details-info-label">Frequency</span>
          <span className="group-details-info-value">{group.contributionFrequency}</span>
        </div>
        <div className="group-details-info-item">
          <span className="group-details-info-label">Status</span>
          <Badge variant={getStatusVariant(group.status)} size="sm">
            {group.status}
          </Badge>
        </div>
      </div>

      {group.description && (
        <div className="group-details-description">
          <h4>Description</h4>
          <p>{group.description}</p>
        </div>
      )}

      <div className="group-details-progress-section">
        <div className="group-details-progress-header">
          <h4>Progress</h4>
          <span className="group-details-progress-text">
            {formatAmount(group.currentAmount)} / {formatAmount(group.targetAmount)}
          </span>
        </div>
        <div className="group-details-progress-bar">
          <div
            className="group-details-progress-fill"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <span className="group-details-progress-percentage">
          {progressPercentage.toFixed(1)}% Complete
        </span>
      </div>
    </div>
  );

  // Cycle Tab Content
  const cycleContent = (
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
            <span>{formatDate(currentCycle.startDate)} - {formatDate(currentCycle.endDate)}</span>
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
                {formatDate(cycle.startDate)} - {formatDate(cycle.endDate)}
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

  // Members Tab Content
  const membersContent = (
    <div className="group-details-members">
      <div className="group-details-members-header">
        <h4>Members ({members.length})</h4>
      </div>
      <div className="group-details-members-list">
        {members.map((member) => (
          <div
            key={member.id}
            className={`group-details-member-item ${onMemberClick ? 'group-details-member-clickable' : ''}`}
            onClick={() => onMemberClick?.(member)}
          >
            <Avatar
              name={member.name || member.address}
              size="md"
            />
            <div className="group-details-member-info">
              <div className="group-details-member-name">
                {member.name || 'Anonymous'}
              </div>
              <div className="group-details-member-address">
                {member.address.substring(0, 8)}...{member.address.substring(member.address.length - 6)}
              </div>
            </div>
            <div className="group-details-member-stats">
              <div className="group-details-member-contributions">
                {formatAmount(member.totalContributions)}
              </div>
              <Badge
                variant={member.isActive ? 'success' : 'secondary'}
                size="sm"
              >
                {member.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Contributions Tab Content
  const contributionsContent = (
    <div className="group-details-contributions">
      <div className="group-details-contributions-header">
        <h4>Contribution History ({contributions.length})</h4>
      </div>
      <div className="group-details-contributions-list">
        {contributions.map((contribution) => (
          <div
            key={contribution.id}
            className={`group-details-contribution-item ${onContributionClick ? 'group-details-contribution-clickable' : ''}`}
            onClick={() => onContributionClick?.(contribution)}
          >
            <div className="group-details-contribution-main">
              <Avatar
                name={contribution.memberName || contribution.memberId}
                size="sm"
              />
              <div className="group-details-contribution-info">
                <div className="group-details-contribution-member">
                  {contribution.memberName || 'Anonymous'}
                </div>
                <div className="group-details-contribution-date">
                  {formatDate(contribution.timestamp)}
                </div>
              </div>
            </div>
            <div className="group-details-contribution-details">
              <div className="group-details-contribution-amount">
                {formatAmount(contribution.amount)}
              </div>
              <Badge variant={getStatusVariant(contribution.status)} size="sm">
                {contribution.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const tabs: Tab[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: '📊',
      content: overviewContent,
    },
    {
      id: 'cycle',
      label: 'Cycles',
      icon: '🔄',
      content: cycleContent,
    },
    {
      id: 'members',
      label: 'Members',
      icon: '👥',
      content: membersContent,
    },
    {
      id: 'contributions',
      label: 'Contributions',
      icon: '💰',
      content: contributionsContent,
    },
  ];

  return (
    <div className={`group-details ${className}`}>
      <Card variant="elevated">
        <div className="group-details-header">
          <div className="group-details-title-section">
            <h2 className="group-details-title">{group.name}</h2>
            <Badge variant={getStatusVariant(group.status)}>
              {group.status}
            </Badge>
          </div>
        </div>

        <Tabs
          tabs={tabs}
          defaultTab={selectedTab}
          onChange={setSelectedTab}
          variant="underline"
        />
      </Card>
    </div>
  );
}
