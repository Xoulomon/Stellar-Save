import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GroupDetails } from '../components/GroupDetails';
import type { GroupInfo, GroupMember, Contribution, CycleInfo } from '../components/GroupDetails';

const group: GroupInfo = {
  id: 'g1',
  name: 'Test Group',
  description: 'A test savings group',
  createdAt: new Date('2024-01-01'),
  totalMembers: 2,
  targetAmount: 2000,
  currentAmount: 1000,
  contributionFrequency: 'monthly',
  status: 'active',
};

const members: GroupMember[] = [
  {
    id: 'm1',
    address: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
    name: 'Alice',
    joinedAt: new Date('2024-01-01'),
    totalContributions: 500,
    isActive: true,
  },
  {
    id: 'm2',
    address: 'GZYXWVUTSRQPONMLKJIHGFEDCBA654321',
    joinedAt: new Date('2024-01-02'),
    totalContributions: 500,
    isActive: false,
  },
];

const contributions: Contribution[] = [
  {
    id: 'c1',
    memberId: 'm1',
    memberName: 'Alice',
    amount: 500,
    timestamp: new Date('2024-02-01'),
    transactionHash: '0xabc',
    status: 'completed',
  },
];

const cycles: CycleInfo[] = [
  {
    cycleNumber: 1,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-02-01'),
    targetAmount: 2000,
    currentAmount: 2000,
    status: 'completed',
  },
];

describe('GroupDetails', () => {
  it('renders group name', () => {
    render(
      <GroupDetails
        group={group}
        members={members}
        contributions={contributions}
        cycles={cycles}
      />,
    );
    expect(screen.getByText('Test Group')).toBeInTheDocument();
  });

  it('renders overview tab by default', () => {
    render(
      <GroupDetails
        group={group}
        members={members}
        contributions={contributions}
        cycles={cycles}
      />,
    );
    expect(screen.getByText('A test savings group')).toBeInTheDocument();
  });

  it('switches to members tab', () => {
    render(
      <GroupDetails
        group={group}
        members={members}
        contributions={contributions}
        cycles={cycles}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: /members/i }));
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('switches to contributions tab', () => {
    render(
      <GroupDetails
        group={group}
        members={members}
        contributions={contributions}
        cycles={cycles}
      />,
    );
    fireEvent.click(screen.getByText('Contributions'));
    expect(screen.getByText('Contribution History (1)')).toBeInTheDocument();
  });

  it('calls onMemberClick when member is clicked', () => {
    const onMemberClick = vi.fn();
    render(
      <GroupDetails
        group={group}
        members={members}
        contributions={contributions}
        cycles={cycles}
        onMemberClick={onMemberClick}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: /members/i }));
    fireEvent.click(screen.getByText('Alice'));
    expect(onMemberClick).toHaveBeenCalledWith(members[0]);
  });

  it('renders current cycle when provided', () => {
    const currentCycle: CycleInfo = {
      cycleNumber: 2,
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-03-01'),
      targetAmount: 2000,
      currentAmount: 500,
      status: 'active',
    };
    render(
      <GroupDetails
        group={group}
        members={members}
        contributions={contributions}
        cycles={cycles}
        currentCycle={currentCycle}
      />,
    );
    fireEvent.click(screen.getByText('Cycles'));
    expect(screen.getByText('Current Cycle #2')).toBeInTheDocument();
  });

  it('shows inactive badge for inactive member', () => {
    render(
      <GroupDetails
        group={group}
        members={members}
        contributions={contributions}
        cycles={cycles}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: /members/i }));
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });
});
