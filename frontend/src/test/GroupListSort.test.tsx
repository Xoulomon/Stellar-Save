import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';

import { GroupList } from '../components/GroupList';
import type { Group } from '../components/GroupList';

// Deliberately unordered so the assertions exercise the comparator rather than
// the input order.
const groups: Group[] = [
  { id: 'b', name: 'Beta', memberCount: 30, createdAt: new Date('2024-02-01') },
  { id: 'a', name: 'alpha', memberCount: 10, createdAt: new Date('2024-03-01') },
  { id: 'c', name: 'Gamma', memberCount: 20, createdAt: new Date('2024-01-01') },
];

function renderedOrder(): string[] {
  return screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent ?? '');
}

async function pickSort(label: string): Promise<void> {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /^Sort:/ }));
  await user.click(screen.getByRole('menuitem', { name: label }));
}

describe('GroupList sorting', () => {
  it('sorts by name case-insensitively (ascending by default)', () => {
    render(<GroupList groups={groups} showPagination={false} />);
    expect(renderedOrder()).toEqual(['alpha', 'Beta', 'Gamma']);
  });

  it('reverses the order when the active sort is toggled', async () => {
    render(<GroupList groups={groups} showPagination={false} />);
    await pickSort('Name');
    expect(renderedOrder()).toEqual(['Gamma', 'Beta', 'alpha']);
  });

  it('sorts numerically by member count', async () => {
    render(<GroupList groups={groups} showPagination={false} />);
    await pickSort('Members');
    expect(renderedOrder()).toEqual(['alpha', 'Gamma', 'Beta']);
  });

  it('sorts chronologically by creation date', async () => {
    render(<GroupList groups={groups} showPagination={false} />);
    await pickSort('Date Created');
    expect(renderedOrder()).toEqual(['Gamma', 'Beta', 'alpha']);
  });

  it('pushes groups with a missing sort value to the end', () => {
    const withMissing: Group[] = [
      { id: '1', name: 'Has count', memberCount: 5 },
      { id: '2', name: 'No count' },
    ];
    render(
      <GroupList groups={withMissing} defaultSortField="memberCount" showPagination={false} />
    );
    expect(renderedOrder()).toEqual(['Has count', 'No count']);
  });
});
