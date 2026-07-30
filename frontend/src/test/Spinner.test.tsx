import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Spinner, FullPageLoader } from '../components/Spinner';

describe('Spinner', () => {
  it('renders with default props', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders with custom aria-label', () => {
    render(<Spinner ariaLabel="Fetching data" />);
    expect(screen.getByRole('status', { name: 'Fetching data' })).toBeInTheDocument();
  });

  it('renders label text when provided', () => {
    render(<Spinner label="Please wait..." />);
    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });

  it('does not render label when not provided', () => {
    render(<Spinner />);
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it.each(['sm', 'md', 'lg'] as const)('renders size variant: %s', (size) => {
    const { container } = render(<Spinner size={size} />);
    expect(container.querySelector(`.spinner-${size}`)).toBeInTheDocument();
  });

  it.each(['primary', 'secondary', 'danger', 'success', 'white'] as const)(
    'renders color variant: %s',
    (color) => {
      const { container } = render(<Spinner color={color} />);
      expect(container.querySelector(`.spinner-${color}`)).toBeInTheDocument();
    }
  );
});

describe('FullPageLoader', () => {
  it('renders when loading is true', () => {
    render(<FullPageLoader loading={true} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders nothing when loading is false', () => {
    const { container } = render(<FullPageLoader loading={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders custom message', () => {
    render(<FullPageLoader loading={true} message="Saving..." />);
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('renders default message when none provided', () => {
    render(<FullPageLoader loading={true} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
