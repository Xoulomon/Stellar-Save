import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from '../components/Tooltip';

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger element', () => {
    render(
      <Tooltip content="Helpful hint">
        <button>Hover me</button>
      </Tooltip>
    );
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('shows tooltip on mouse enter after delay', async () => {
    render(
      <Tooltip content="Helpful hint" delay={200}>
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByText('Hover me');
    await userEvent.hover(button);

    // Tooltip should not be visible immediately
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Fast-forward time
    vi.advanceTimersByTime(200);

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      expect(screen.getByText('Helpful hint')).toBeInTheDocument();
    });
  });

  it('hides tooltip on mouse leave', async () => {
    render(
      <Tooltip content="Helpful hint" delay={0}>
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByText('Hover me');
    await userEvent.hover(button);
    
    vi.advanceTimersByTime(0);

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    await userEvent.unhover(button);

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('shows tooltip on focus', async () => {
    render(
      <Tooltip content="Helpful hint" delay={0}>
        <button>Focus me</button>
      </Tooltip>
    );

    const button = screen.getByText('Focus me');
    button.focus();

    vi.advanceTimersByTime(0);

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  it('hides tooltip on blur', async () => {
    render(
      <Tooltip content="Helpful hint" delay={0}>
        <button>Focus me</button>
      </Tooltip>
    );

    const button = screen.getByText('Focus me');
    button.focus();

    vi.advanceTimersByTime(0);

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    button.blur();

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('does not show tooltip when disabled', async () => {
    render(
      <Tooltip content="Helpful hint" disabled delay={0}>
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByText('Hover me');
    await userEvent.hover(button);

    vi.advanceTimersByTime(0);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('applies correct position class', async () => {
    const { rerender } = render(
      <Tooltip content="Hint" position="top" delay={0}>
        <button>Button</button>
      </Tooltip>
    );

    const button = screen.getByText('Button');
    await userEvent.hover(button);
    vi.advanceTimersByTime(0);

    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass('tooltip-top');
    });

    await userEvent.unhover(button);

    rerender(
      <Tooltip content="Hint" position="bottom" delay={0}>
        <button>Button</button>
      </Tooltip>
    );

    await userEvent.hover(button);
    vi.advanceTimersByTime(0);

    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass('tooltip-bottom');
    });
  });

  it('sets aria-describedby when tooltip is visible', async () => {
    render(
      <Tooltip content="Helpful hint" delay={0}>
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByText('Hover me');
    
    // Initially no aria-describedby
    expect(button).not.toHaveAttribute('aria-describedby');

    await userEvent.hover(button);
    vi.advanceTimersByTime(0);

    await waitFor(() => {
      expect(button).toHaveAttribute('aria-describedby');
    });
  });

  it('applies custom className', async () => {
    render(
      <Tooltip content="Hint" className="custom-tooltip" delay={0}>
        <button>Button</button>
      </Tooltip>
    );

    const button = screen.getByText('Button');
    await userEvent.hover(button);
    vi.advanceTimersByTime(0);

    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass('custom-tooltip');
    });
  });
});
