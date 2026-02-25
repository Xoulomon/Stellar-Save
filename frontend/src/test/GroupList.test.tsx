import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GroupList, Group } from '../components/GroupList';

const mockGroups: Group[] = [
  {
    id: '1',
    name: 'Alpha Group',
    description: 'First test group',
    memberCount: 10,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    name: 'Beta Group',
    description: 'Second test group',
    memberCount: 25,
    createdAt: new Date('2024-02-01'),
  },
  {
    id: '3',
    name: 'Gamma Group',
    description: 'Third test group',
    memberCount: 5,
    createdAt: new Date('2024-03-01'),
  },
];

describe('GroupList', () => {
  it('renders groups correctly', () => {
    render(<GroupList groups={mockGroups} />);
    
    expect(screen.getByText('Alpha Group')).toBeInTheDocument();
    expect(screen.getByText('Beta Group')).toBeInTheDocument();
    expect(screen.getByText('Gamma Group')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<GroupList groups={[]} loading={true} />);
    
    const loadingItems = document.querySelectorAll('.group-list-loading .group-list-item');
    expect(loadingItems.length).toBeGreaterThan(0);
  });

  it('shows empty state when no groups', () => {
    render(
      <GroupList
        groups={[]}
        emptyTitle="No groups"
        emptyDescription="Create your first group"
      />
    );
    
    expect(screen.getByText('No groups')).toBeInTheDocument();
    expect(screen.getByText('Create your first group')).toBeInTheDocument();
  });

  it('calls onEmptyAction when empty action button is clicked', () => {
    const handleEmptyAction = vi.fn();
    
    render(
      <GroupList
        groups={[]}
        emptyActionLabel="Create Group"
        onEmptyAction={handleEmptyAction}
      />
    );
    
    const actionButton = screen.getByText('Create Group');
    fireEvent.click(actionButton);
    
    expect(handleEmptyAction).toHaveBeenCalledTimes(1);
  });

  it('filters groups based on search query', async () => {
    render(<GroupList groups={mockGroups} />);
    
    const searchInput = screen.getByPlaceholderText('Search groups...');
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });
    
    await waitFor(() => {
      expect(screen.getByText('Alpha Group')).toBeInTheDocument();
      expect(screen.queryByText('Beta Group')).not.toBeInTheDocument();
      expect(screen.queryByText('Gamma Group')).not.toBeInTheDocument();
    });
  });

  it('calls onGroupClick when a group is clicked', () => {
    const handleGroupClick = vi.fn();
    
    render(<GroupList groups={mockGroups} onGroupClick={handleGroupClick} />);
    
    const firstGroup = screen.getByText('Alpha Group').closest('.card');
    if (firstGroup) {
      fireEvent.click(firstGroup);
    }
    
    expect(handleGroupClick).toHaveBeenCalledWith(mockGroups[0]);
  });

  it('paginates groups correctly', () => {
    const manyGroups: Group[] = Array.from({ length: 25 }, (_, i) => ({
      id: `${i + 1}`,
      name: `Group ${i + 1}`,
      description: `Description ${i + 1}`,
      memberCount: i + 1,
    }));
    
    render(<GroupList groups={manyGroups} pageSize={10} />);
    
    // Should show first 10 groups
    expect(screen.getByText('Group 1')).toBeInTheDocument();
    expect(screen.getByText('Group 10')).toBeInTheDocument();
    expect(screen.queryByText('Group 11')).not.toBeInTheDocument();
    
    // Navigate to page 2
    const page2Button = screen.getByLabelText('Page 2');
    fireEvent.click(page2Button);
    
    expect(screen.getByText('Group 11')).toBeInTheDocument();
    expect(screen.queryByText('Group 1')).not.toBeInTheDocument();
  });

  it('hides search when showSearch is false', () => {
    render(<GroupList groups={mockGroups} showSearch={false} />);
    
    expect(screen.queryByPlaceholderText('Search groups...')).not.toBeInTheDocument();
  });

  it('hides sort when showSort is false', () => {
    render(<GroupList groups={mockGroups} showSort={false} />);
    
    expect(screen.queryByText(/Sort:/)).not.toBeInTheDocument();
  });

  it('hides pagination when showPagination is false', () => {
    render(<GroupList groups={mockGroups} showPagination={false} />);
    
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });

  it('uses custom renderGroupItem when provided', () => {
    const customRender = (group: Group) => (
      <div key={group.id} data-testid="custom-group">
        Custom: {group.name}
      </div>
    );
    
    render(<GroupList groups={mockGroups} renderGroupItem={customRender} />);
    
    const customItems = screen.getAllByTestId('custom-group');
    expect(customItems).toHaveLength(3);
    expect(screen.getByText('Custom: Alpha Group')).toBeInTheDocument();
  });

  it('displays member count correctly', () => {
    render(<GroupList groups={mockGroups} />);
    
    expect(screen.getByText('10 members')).toBeInTheDocument();
    expect(screen.getByText('25 members')).toBeInTheDocument();
    expect(screen.getByText('5 members')).toBeInTheDocument();
  });

  it('displays singular member when count is 1', () => {
    const singleMemberGroup: Group[] = [
      {
        id: '1',
        name: 'Solo Group',
        memberCount: 1,
      },
    ];
    
    render(<GroupList groups={singleMemberGroup} />);
    
    expect(screen.getByText('1 member')).toBeInTheDocument();
  });

  it('displays avatar placeholder when no avatar provided', () => {
    render(<GroupList groups={mockGroups} />);
    
    const placeholders = document.querySelectorAll('.group-list-item-avatar-placeholder');
    expect(placeholders.length).toBeGreaterThan(0);
    expect(placeholders[0].textContent).toBe('A'); // First letter of "Alpha Group"
  });
});
