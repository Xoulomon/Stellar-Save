import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GroupBadge } from '../components/GroupBadge';

describe('GroupBadge', () => {
  it('renders active status with success styling and icon', () => {
    render(<GroupBadge status="active" />);

    const badgeText = screen.getByText('active');
    const badge = badgeText.closest('.badge');

    expect(badge).toHaveClass('badge-success');
    expect(badge).toHaveClass('badge-sm');
    expect(badge).toHaveClass('group-badge');
    expect(badge?.querySelector('.group-badge-icon')).toBeInTheDocument();
  });

  it('renders pending status with warning styling', () => {
    render(<GroupBadge status="pending" />);

    const badge = screen.getByText('pending').closest('.badge');
    expect(badge).toHaveClass('badge-warning');
  });

  it('renders complete status with info styling', () => {
    render(<GroupBadge status="complete" />);

    const badge = screen.getByText('complete').closest('.badge');
    expect(badge).toHaveClass('badge-info');
  });

  it('supports completed alias with complete styling', () => {
    render(<GroupBadge status="completed" />);

    const badge = screen.getByText('completed').closest('.badge');
    expect(badge).toHaveClass('badge-info');
  });

  it('supports icon toggle', () => {
    render(<GroupBadge status="active" showIcon={false} />);

    const badge = screen.getByText('active').closest('.badge');
    expect(badge?.querySelector('.group-badge-icon')).not.toBeInTheDocument();
  });
});
