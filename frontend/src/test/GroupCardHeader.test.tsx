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

  it('renders "completed" status badge', () => {
    render(<GroupCardHeader groupName="Beta Fund" status="completed" />);
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('renders "pending" status badge', () => {
    render(<GroupCardHeader groupName="Gamma Circle" status="pending" />);
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('renders group name in a heading element', () => {
    render(<GroupCardHeader groupName="Savings Circle" status="active" />);
    expect(screen.getByRole('heading', { name: 'Savings Circle' })).toBeInTheDocument();
  });

  it('renders both image and description together', () => {
    render(
      <GroupCardHeader
        groupName="Delta Pool"
        status="active"
        imageUrl="https://example.com/d.png"
        description="Pool description"
      />,
    );
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByText('Pool description')).toBeInTheDocument();
  });

  it('image alt text matches the group name', () => {
    render(
      <GroupCardHeader groupName="Epsilon Group" status="active" imageUrl="https://example.com/e.png" />,
    );
    expect(screen.getByAltText('Epsilon Group')).toBeInTheDocument();
  });
});
