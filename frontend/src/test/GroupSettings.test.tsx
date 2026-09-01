import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroupSettings } from '../components/GroupSettings';
import type { GroupDetail } from '../types/group';

// ── Mock useWallet ──────────────────────────────────────────────────────────

const mockActiveAddress = { value: 'GCREATOR1234567890' };

vi.mock('../hooks/useWallet', () => ({
  useWallet: () => ({ activeAddress: mockActiveAddress.value }),
}));

// ── Mock useContract ────────────────────────────────────────────────────────

const mockUpdateGroupMetadata = vi.fn();

vi.mock('../hooks/useContract', () => ({
  useContract: () => ({
    updateGroupMetadata: mockUpdateGroupMetadata,
  }),
}));

const baseGroup: GroupDetail = {
  id: '1',
  name: 'Original Group Name',
  description: 'Original description',
  memberCount: 4,
  contributionAmount: 100,
  currency: 'XLM',
  status: 'active',
  createdAt: new Date('2024-01-01'),
  creator: 'GCREATOR1234567890',
  cycleDuration: 604800,
  maxMembers: 10,
  minMembers: 2,
  currentCycle: 0,
  isActive: true,
  started: false,
  startedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockActiveAddress.value = 'GCREATOR1234567890';
});

describe('GroupSettings', () => {
  it('renders nothing when the connected wallet is not the creator', () => {
    mockActiveAddress.value = 'GSOMEONE_ELSE';
    const { container } = render(<GroupSettings group={baseGroup} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the form pre-filled with the current group values', () => {
    render(<GroupSettings group={baseGroup} />);
    expect(screen.getByLabelText(/group name/i)).toHaveValue('Original Group Name');
    expect(screen.getByLabelText(/description/i)).toHaveValue('Original description');
  });

  it('shows a validation error when the name is cleared', async () => {
    const user = userEvent.setup();
    render(<GroupSettings group={baseGroup} />);

    await user.clear(screen.getByLabelText(/group name/i));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  });

  it('shows a validation error when the name is too short', async () => {
    const user = userEvent.setup();
    render(<GroupSettings group={baseGroup} />);

    await user.clear(screen.getByLabelText(/group name/i));
    await user.type(screen.getByLabelText(/group name/i), 'ab');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/at least 3 characters/i)).toBeInTheDocument();
  });

  it('does not open the confirmation dialog when nothing changed', async () => {
    const user = userEvent.setup();
    render(<GroupSettings group={baseGroup} />);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(screen.queryByText('Confirm Changes')).not.toBeInTheDocument();
  });

  it('opens a confirmation dialog with the diff when a field changes', async () => {
    const user = userEvent.setup();
    render(<GroupSettings group={baseGroup} />);

    await user.clear(screen.getByLabelText(/group name/i));
    await user.type(screen.getByLabelText(/group name/i), 'Updated Group Name');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText('Confirm Changes')).toBeInTheDocument();
    expect(screen.getByText('Original Group Name')).toBeInTheDocument();
    expect(screen.getByText('Updated Group Name')).toBeInTheDocument();
  });

  it('submits the updated values on confirm', async () => {
    mockUpdateGroupMetadata.mockResolvedValue({ txHash: 'tx_settings_1', error: null });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<GroupSettings group={baseGroup} onSaved={onSaved} />);

    await user.clear(screen.getByLabelText(/group name/i));
    await user.type(screen.getByLabelText(/group name/i), 'Updated Group Name');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await user.click(await screen.findByRole('button', { name: /^confirm$/i }));

    await waitFor(() => {
      expect(mockUpdateGroupMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: 1n,
          name: 'Updated Group Name',
          description: 'Original description',
        })
      );
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it('closes the dialog without submitting on cancel', async () => {
    const user = userEvent.setup();
    render(<GroupSettings group={baseGroup} />);

    await user.clear(screen.getByLabelText(/group name/i));
    await user.type(screen.getByLabelText(/group name/i), 'Updated Group Name');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await user.click(await screen.findByRole('button', { name: /cancel/i }));

    expect(screen.queryByText('Confirm Changes')).not.toBeInTheDocument();
    expect(mockUpdateGroupMetadata).not.toHaveBeenCalled();
  });
});
