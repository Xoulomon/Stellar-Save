import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../components/Badge';

describe('Badge', () => {
  it('renders with default props', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders with different variants', () => {
    const { rerender } = render(<Badge variant="success">Success</Badge>);
    expect(screen.getByText('Success')).toHaveClass('badge-success');

    rerender(<Badge variant="danger">Danger</Badge>);
    expect(screen.getByText('Danger')).toHaveClass('badge-danger');

    rerender(<Badge variant="warning">Warning</Badge>);
    expect(screen.getByText('Warning')).toHaveClass('badge-warning');
  });

  it('renders with different sizes', () => {
    const { rerender } = render(<Badge size="sm">Small</Badge>);
    expect(screen.getByText('Small')).toHaveClass('badge-sm');

    rerender(<Badge size="lg">Large</Badge>);
    expect(screen.getByText('Large')).toHaveClass('badge-lg');
  });

  it('renders with icon on left', () => {
    render(<Badge icon={<span>🔔</span>}>Notification</Badge>);
    const badge = screen.getByText('Notification').parentElement;
    expect(badge?.querySelector('.badge-icon')).toBeInTheDocument();
  });

  it('renders with icon on right', () => {
    render(<Badge icon={<span>→</span>} iconPosition="right">Next</Badge>);
    const badge = screen.getByText('Next').parentElement;
    expect(badge?.querySelector('.badge-icon')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Badge className="custom-class">Custom</Badge>);
    expect(screen.getByText('Custom')).toHaveClass('custom-class');
  });
});
