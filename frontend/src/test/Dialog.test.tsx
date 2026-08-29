import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';

import { Dialog } from '../components/Dialog';

expect.extend(toHaveNoViolations);

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Dialog open={false} onClose={vi.fn()} title="Hidden">
        body
      </Dialog>
    );
    expect(container.firstChild).toBeNull();
  });

  it('exposes role, aria-modal and an accessible name from the title', () => {
    render(
      <Dialog open onClose={vi.fn()} title="Delete group">
        Are you sure?
      </Dialog>
    );
    const dialog = screen.getByRole('dialog', { name: 'Delete group' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('wires aria-describedby to the description', () => {
    render(
      <Dialog open onClose={vi.fn()} title="Delete group" description="This cannot be undone">
        body
      </Dialog>
    );
    const dialog = screen.getByRole('dialog');
    const describedBy = dialog.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      'This cannot be undone'
    );
  });

  it('falls back to aria-label when there is no visible title', () => {
    render(
      <Dialog open onClose={vi.fn()} aria-label="Quick actions" showCloseButton={false}>
        body
      </Dialog>
    );
    expect(screen.getByRole('dialog', { name: 'Quick actions' })).toBeInTheDocument();
  });

  it('defers to an external labelling element via labelledBy', () => {
    render(
      <Dialog open onClose={vi.fn()} labelledBy="external-title" showCloseButton={false}>
        <h2 id="external-title">Confirm payout</h2>
      </Dialog>
    );
    expect(screen.getByRole('dialog', { name: 'Confirm payout' })).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T">
        body
      </Dialog>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on Escape when closeOnEscape is false', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T" closeOnEscape={false}>
        body
      </Dialog>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the backdrop is clicked but not the surface', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T">
        body
      </Dialog>
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(dialog.parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on backdrop click when closeOnBackdropClick is false', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T" closeOnBackdropClick={false}>
        body
      </Dialog>
    );
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes via the header close button', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="T">
        body
      </Dialog>
    );
    fireEvent.click(screen.getByRole('button', { name: /close dialog/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks background scroll while open and restores it on close', () => {
    const { rerender } = render(
      <Dialog open onClose={vi.fn()} title="T">
        body
      </Dialog>
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Dialog open={false} onClose={vi.fn()} title="T">
        body
      </Dialog>
    );
    expect(document.body.style.overflow).toBe('');
  });

  it('moves focus into the dialog on open and traps Tab', async () => {
    const user = userEvent.setup();
    render(
      <Dialog open onClose={vi.fn()} title="T" showCloseButton={false}>
        <button>First</button>
        <button>Second</button>
      </Dialog>
    );

    const first = screen.getByRole('button', { name: 'First' });
    const second = screen.getByRole('button', { name: 'Second' });

    expect(document.activeElement).toBe(first);

    second.focus();
    await user.tab();
    expect(document.activeElement).toBe(first);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(second);
  });

  it('restores focus to the trigger when unmounted', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button onClick={() => setOpen(true)}>Open</button>
          {open && (
            <Dialog open onClose={() => setOpen(false)} title="T" showCloseButton={false}>
              <button>Inside</button>
            </Dialog>
          )}
        </div>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <Dialog open onClose={vi.fn()} title="Delete group" description="This cannot be undone">
        <p>Body content</p>
      </Dialog>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
