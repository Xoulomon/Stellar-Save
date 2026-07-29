import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MembersPanel } from '../components/panels/MembersPanel';
import type { GroupMember } from '../utils/groupApi';
import { buildGroupMember } from '@stellar-save/test-fixtures';

const mockMembers: GroupMember[] = [
  buildGroupMember({ id: 'm1', address: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ123456', name: 'Alice', joinedAt: new Date('2024-01-01'), totalContributions: 500, isActive: true }),
  buildGroupMember({ id: 'm2', address: 'GZYXWVUTSRQPONMLKJIHGFEDCBA654321', name: 'Bob', joinedAt: new Date('2024-01-02'), totalContributions: 300, isActive: false }),
];

describe('MembersPanel', () => {
  it('renders member count', () => {
    render(<MembersPanel members={mockMembers} />);
    expect(screen.getByText('Members (2)')).toBeInTheDocument();
  });

  it('renders all member names', () => {
    render(<MembersPanel members={mockMembers} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('displays active badge for active members', () => {
    render(<MembersPanel members={mockMembers} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('displays inactive badge for inactive members', () => {
    render(<MembersPanel members={mockMembers} />);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('calls onMemberClick when member is clicked', () => {
    const onMemberClick = vi.fn();
    render(<MembersPanel members={mockMembers} onMemberClick={onMemberClick} />);
    fireEvent.click(screen.getByText('Alice'));
    expect(onMemberClick).toHaveBeenCalledWith(mockMembers[0]);
  });

  it('renders truncated member addresses', () => {
    render(<MembersPanel members={mockMembers} />);
    expect(screen.getByText(/GABCDEF.../)).toBeInTheDocument();
  });

  it('renders empty when no members', () => {
    render(<MembersPanel members={[]} />);
    expect(screen.getByText('Members (0)')).toBeInTheDocument();
  });
});
