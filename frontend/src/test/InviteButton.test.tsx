import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InviteButton } from '../components/InviteButton';

// Mock InviteModal to isolate InviteButton behaviour
vi.mock('../components/InviteModal', () => ({
  InviteModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div role="dialog" aria-label="invite-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

describe('InviteButton', () => {
  it('renders an Invite button', () => {
    render(<InviteButton groupId="g1" groupName="My Group" />);
    expect(screen.getByRole('button', { name: /invite members to my group/i })).toBeInTheDocument();
  });

  it('opens the modal on click', () => {
    render(<InviteButton groupId="g1" groupName="My Group" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /invite/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes the modal when onClose is called', () => {
    render(<InviteButton groupId="g1" groupName="My Group" />);
    fireEvent.click(screen.getByRole('button', { name: /invite/i }));
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
