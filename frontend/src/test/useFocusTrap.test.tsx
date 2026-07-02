import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

function TrapContainer({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, active);
  return (
    <div>
      <button data-testid="outside">Outside</button>
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Test dialog">
        <button data-testid="first">First</button>
        <button data-testid="second">Second</button>
        <button data-testid="last">Last</button>
      </div>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('moves focus to the first focusable element when activated', () => {
    render(<TrapContainer active={true} />);
    expect(document.activeElement).toBe(screen.getByTestId('first'));
  });

  it('does not move focus when inactive', () => {
    render(<TrapContainer active={false} />);
    // No automatic focus movement — document.body or nothing should be active
    expect(document.activeElement).not.toBe(screen.getByTestId('first'));
  });

  it('wraps Tab from the last element back to first', async () => {
    const user = userEvent.setup();
    render(<TrapContainer active={true} />);

    screen.getByTestId('last').focus();
    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(screen.getByTestId('first'));
  });

  it('wraps Shift+Tab from the first element back to last', async () => {
    const user = userEvent.setup();
    render(<TrapContainer active={true} />);

    screen.getByTestId('first').focus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(screen.getByTestId('last'));
  });
});
