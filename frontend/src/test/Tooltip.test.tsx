import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { Tooltip } from '../components/Tooltip';

afterEach(() => {
  vi.useRealTimers();
});

describe('Tooltip', () => {
  it('renders trigger element', () => {
    render(
      <Tooltip content="Helpful hint">
        <button>Hover me</button>
      </Tooltip>
    );
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('shows tooltip on mouse enter after delay', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Helpful hint" delay={200}>
        <button>Hover me</button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByText('Hover me'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('hides tooltip on mouse leave', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Helpful hint" delay={0}>
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByText('Hover me');
    fireEvent.mouseEnter(button);
    act(() => { vi.advanceTimersByTime(0); });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.mouseLeave(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on focus', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Helpful hint" delay={0}>
        <button>Focus me</button>
      </Tooltip>
    );

    fireEvent.focus(screen.getByText('Focus me'));
    act(() => { vi.advanceTimersByTime(0); });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('hides tooltip on blur', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Helpful hint" delay={0}>
        <button>Focus me</button>
      </Tooltip>
    );

    const button = screen.getByText('Focus me');
    fireEvent.focus(button);
    act(() => { vi.advanceTimersByTime(0); });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.blur(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('does not show tooltip when disabled', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Helpful hint" disabled delay={0}>
        <button>Hover me</button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByText('Hover me'));
    act(() => { vi.advanceTimersByTime(0); });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('applies correct position class', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <Tooltip content="Hint" position="top" delay={0}>
        <button>Button</button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByText('Button'));
    act(() => { vi.advanceTimersByTime(0); });
    expect(screen.getByRole('tooltip')).toHaveClass('tooltip-top');

    fireEvent.mouseLeave(screen.getByText('Button'));

    rerender(
      <Tooltip content="Hint" position="bottom" delay={0}>
        <button>Button</button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByText('Button'));
    act(() => { vi.advanceTimersByTime(0); });
    expect(screen.getByRole('tooltip')).toHaveClass('tooltip-bottom');
  });

  it('sets aria-describedby when tooltip is visible', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Helpful hint" delay={0}>
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByText('Hover me');
    expect(button).not.toHaveAttribute('aria-describedby');

    fireEvent.mouseEnter(button);
    act(() => { vi.advanceTimersByTime(0); });
    expect(button).toHaveAttribute('aria-describedby');
  });

  it('applies custom className', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Hint" className="custom-tooltip" delay={0}>
        <button>Button</button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByText('Button'));
    act(() => { vi.advanceTimersByTime(0); });
    expect(screen.getByRole('tooltip')).toHaveClass('custom-tooltip');
  });
});
