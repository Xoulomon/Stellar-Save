import { useState } from 'react';

import './GroupDetails.css';
import { Badge } from './Badge';
import { Card } from './Card';
import { OverviewPanel, MembersPanel, ContributionsPanel, PayoutSchedulePanel } from './panels';
import { Tabs, type Tab } from './Tabs';

import type { DetailedGroup, GroupMember, GroupContribution, GroupCycle } from '../utils/groupApi';

interface GroupDetailsProps {
  group: DetailedGroup;
  members: GroupMember[];
  contributions: GroupContribution[];
  cycles: GroupCycle[];
  currentCycle?: GroupCycle;
  onMemberClick?: (member: GroupMember) => void;
  onContributionClick?: (contribution: GroupContribution) => void;
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

  const tabs: Tab[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: '📊',
      content: <OverviewPanel group={group} contributions={contributions} cycles={cycles} />,
    },
    {
      id: 'cycle',
      label: 'Cycles',
      icon: '🔄',
      content: <PayoutSchedulePanel cycles={cycles} currentCycle={currentCycle} />,
    },
    {
      id: 'members',
      label: 'Members',
      icon: '👥',
      content: <MembersPanel members={members} onMemberClick={onMemberClick} />,
    },
    {
      id: 'contributions',
      label: 'Contributions',
      icon: '💰',
      content: (
        <ContributionsPanel
          contributions={contributions}
          onContributionClick={onContributionClick}
        />
      ),
    },
  ];

  return (
    <div className={`group-details ${className}`}>
      <Card variant="elevated">
        <div className="group-details-header">
          <div className="group-details-title-section">
            <h2 className="group-details-title">{group.name}</h2>
            <Badge variant={getStatusVariant(group.status)}>{group.status}</Badge>
          </div>
        </div>

        <Tabs tabs={tabs} defaultTab={selectedTab} onChange={setSelectedTab} variant="underline" />
      </Card>
    </div>
  );
}
