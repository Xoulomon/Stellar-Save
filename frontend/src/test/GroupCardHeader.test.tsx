import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { GroupCardHeader } from '../components/GroupCardHeader';

describe('GroupCardHeader', () => {
  it('renders the group name and status badge', () => {
    render(<GroupCardHeader groupName="Alpha Savers" status="active" />);
    expect(screen.getByText('Alpha Savers')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<GroupCardHeader groupName="Alpha Savers" status="active" description="A great group" />);
    expect(screen.getByText('A great group')).toBeInTheDocument();
  });

  it('does not render a description block when none is provided', () => {
    const { container } = render(<GroupCardHeader groupName="Alpha Savers" status="active" />);
    expect(container.querySelector('.group-card-description')).toBeNull();
  });

  it('renders the image when imageUrl is provided', () => {
    render(<GroupCardHeader groupName="Alpha Savers" status="active" imageUrl="https://example.com/a.png" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/a.png');
    expect(img).toHaveAttribute('alt', 'Alpha Savers');
  });

  it('does not render an image when imageUrl is not provided', () => {
    render(<GroupCardHeader groupName="Alpha Savers" status="active" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
