import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Avatar } from '../components/Avatar';

describe('Avatar', () => {
  it('renders with image when src is provided', () => {
    render(<Avatar src="https://example.com/avatar.jpg" alt="User Avatar" />);
    const img = screen.getByRole('img', { name: 'User Avatar' });
    expect(img).toBeInTheDocument();
  });

  it('renders initials when name is provided without image', () => {
    render(<Avatar name="John Doe" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders single initial for single word name', () => {
    render(<Avatar name="John" />);
    expect(screen.getByText('JO')).toBeInTheDocument();
  });

  it('renders identicon when name is provided without initials display', () => {
    const { container } = render(<Avatar name="test@example.com" />);
    const identicon = container.querySelector('.avatar-identicon');
    expect(identicon).toBeInTheDocument();
  });

  it('renders fallback when no props provided', () => {
    render(<Avatar />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('falls back to initials when image fails to load', async () => {
    const { container } = render(
      <Avatar src="invalid-url.jpg" name="Jane Smith" />
    );
    
    const img = container.querySelector('img');
    if (img) {
      img.dispatchEvent(new Event('error'));
    }
    
    await waitFor(() => {
      expect(screen.getByText('JS')).toBeInTheDocument();
    });
  });

  it('renders with different sizes', () => {
    const { rerender, container } = render(<Avatar name="Test" size="xs" />);
    expect(container.querySelector('.avatar-xs')).toBeInTheDocument();

    rerender(<Avatar name="Test" size="sm" />);
    expect(container.querySelector('.avatar-sm')).toBeInTheDocument();

    rerender(<Avatar name="Test" size="md" />);
    expect(container.querySelector('.avatar-md')).toBeInTheDocument();

    rerender(<Avatar name="Test" size="lg" />);
    expect(container.querySelector('.avatar-lg')).toBeInTheDocument();

    rerender(<Avatar name="Test" size="xl" />);
    expect(container.querySelector('.avatar-xl')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Avatar name="Test" className="custom-avatar" />);
    expect(container.querySelector('.custom-avatar')).toBeInTheDocument();
  });

  it('uses alt text for aria-label when provided', () => {
    render(<Avatar src="avatar.jpg" alt="Custom Alt Text" />);
    expect(screen.getByRole('img', { name: 'Custom Alt Text' })).toBeInTheDocument();
  });

  it('uses name for aria-label when alt is not provided', () => {
    render(<Avatar name="John Doe" />);
    expect(screen.getByRole('img', { name: 'John Doe' })).toBeInTheDocument();
  });
});
