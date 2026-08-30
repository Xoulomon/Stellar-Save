import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ContributionSuccessModal } from '../components/ContributionSuccessModal';

expect.extend(toHaveNoViolations);

// AudioContext is not available in jsdom — mock it
beforeEach(() => {
  Object.defineProperty(window, 'AudioContext', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      createOscillator: () => ({
        connect: vi.fn(),
        type: '',
        frequency: { value: 0 },
        start: vi.fn(),
        stop: vi.fn(),
      }),
      createGain: () => ({
        connect: vi.fn(),
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      }),
      destination: {},
      currentTime: 0,
    })),
  });
});

describe('ContributionSuccessModal', () => {
  const baseProps = {
    open: true,
    amount: 50,
    cycleId: 3,
    onClose: vi.fn(),
  };

  it('renders nothing when closed', () => {
    const { container } = render(<ContributionSuccessModal {...baseProps} open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows amount and cycle when open', () => {
    render(<ContributionSuccessModal {...baseProps} />);
    expect(screen.getByText(/50 XLM/)).toBeInTheDocument();
    expect(screen.getByText(/Cycle #3/)).toBeInTheDocument();
  });

  it('shows success heading', () => {
    render(<ContributionSuccessModal {...baseProps} />);
    expect(screen.getByRole('heading', { name: /Contribution Successful/i })).toBeInTheDocument();
  });

  it('calls onClose when Done button is clicked', () => {
    const onClose = vi.fn();
    render(<ContributionSuccessModal {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close (✕) button is clicked', () => {
    const onClose = vi.fn();
    render(<ContributionSuccessModal {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<ContributionSuccessModal {...baseProps} onClose={onClose} />);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<ContributionSuccessModal {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows milestone badge when milestoneLabel is provided', () => {
    render(<ContributionSuccessModal {...baseProps} milestoneLabel="5th Contribution!" />);
    expect(screen.getByText(/5th Contribution!/)).toBeInTheDocument();
  });

  it('does not show milestone badge when milestoneLabel is absent', () => {
    render(<ContributionSuccessModal {...baseProps} />);
    expect(screen.queryByText(/🏆/)).not.toBeInTheDocument();
  });

  it('shows explorer link when txHash is provided', () => {
    render(<ContributionSuccessModal {...baseProps} txHash="abc123" />);
    const link = screen.getByRole('link', { name: /View on Stellar Explorer/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('abc123'));
  });

  it('does not show explorer link when txHash is absent', () => {
    render(<ContributionSuccessModal {...baseProps} />);
    expect(
      screen.queryByRole('link', { name: /View on Stellar Explorer/i })
    ).not.toBeInTheDocument();
  });

  it('renders a Share button linking to Twitter', () => {
    render(<ContributionSuccessModal {...baseProps} />);
    const shareLink = screen.getByRole('link', { name: /share/i });
    expect(shareLink).toHaveAttribute('href', expect.stringContaining('twitter.com'));
  });

  it('renders mute toggle button', () => {
    render(<ContributionSuccessModal {...baseProps} />);
    expect(screen.getByRole('button', { name: /mute sound/i })).toBeInTheDocument();
  });

  it('toggles mute label when mute button is clicked', () => {
    render(<ContributionSuccessModal {...baseProps} />);
    const muteBtn = screen.getByRole('button', { name: /mute sound/i });
    fireEvent.click(muteBtn);
    expect(screen.getByRole('button', { name: /unmute sound/i })).toBeInTheDocument();
  });

  it('has accessible dialog role and aria-modal', () => {
    render(<ContributionSuccessModal {...baseProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'success-modal-title');
  });

  it('has an aria-describedby pointing to the amount/cycle summary', () => {
    render(<ContributionSuccessModal {...baseProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-describedby', 'success-modal-description');
    expect(document.getElementById('success-modal-description')).toHaveTextContent(/50 XLM/);
  });

  it('has no axe violations', async () => {
    const { container } = render(<ContributionSuccessModal {...baseProps} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations with milestone and explorer link shown', async () => {
    const { container } = render(
      <ContributionSuccessModal {...baseProps} milestoneLabel="5th Contribution!" txHash="abc123" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('moves focus into the dialog when opened', () => {
    render(<ContributionSuccessModal {...baseProps} />);
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it('Tab cycles focus within the dialog and wraps around', async () => {
    const user = userEvent.setup();
    render(<ContributionSuccessModal {...baseProps} txHash="abc123" />);

    const focusable = [
      screen.getByRole('button', { name: /mute sound/i }),
      screen.getByRole('button', { name: /close/i }),
      screen.getByRole('link', { name: /share/i }),
      screen.getByRole('link', { name: /view on stellar explorer/i }),
      screen.getByRole('button', { name: /^done$/i }),
    ];

    // Focus should start on the first focusable element.
    expect(document.activeElement).toBe(focusable[0]);

    // Tab from the last element wraps back to the first.
    focusable[focusable.length - 1].focus();
    await user.tab();
    expect(document.activeElement).toBe(focusable[0]);

    // Shift+Tab from the first element wraps back to the last.
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(focusable[focusable.length - 1]);
  });

  it('restores focus to the triggering element when closed', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button onClick={() => setOpen(true)}>Open</button>
          <ContributionSuccessModal
            open={open}
            amount={50}
            cycleId={3}
            onClose={() => setOpen(false)}
          />
        </div>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: /open/i });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^done$/i }));
    expect(document.activeElement).toBe(trigger);
  });
});
