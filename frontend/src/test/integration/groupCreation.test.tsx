/**
 * Integration tests: Group creation flow
 *
 * Tests the full CreateGroupPage flow: form steps, validation, loading state,
 * success redirect, and error handling. Wallet is mocked as connected.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CreateGroupPage from '../../pages/CreateGroupPage';
import { WalletContext } from '../../wallet/WalletProvider';
import type { WalletContextValue } from '../../wallet/types';
import { createGroup } from '../../utils/groupApi';

// Mock heavy UI wrappers to keep tests focused on flow logic
vi.mock('../../ui', () => ({
  AppLayout: ({ children, title, subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) => (
    <div>
      {title && <h1>{title}</h1>}
      {subtitle && <p>{subtitle}</p>}
      {children}
    </div>
  ),
  AppCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../utils/groupApi', () => ({
  createGroup: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockCreateGroup = vi.mocked(createGroup);

const connectedWallet: WalletContextValue = {
  wallets: [],
  selectedWalletId: 'freighter',
  status: 'connected',
  activeAddress: 'GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  network: 'testnet',
  connectedAccounts: ['GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ'],
  error: null,
  refreshWallets: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  switchWallet: vi.fn(),
  switchAccount: vi.fn(),
};

function renderPage() {
  return render(
    <WalletContext.Provider value={connectedWallet}>
      <MemoryRouter>
        <CreateGroupPage />
      </MemoryRouter>
    </WalletContext.Provider>
  );
}

/**
 * Navigate through all 4 form steps using fireEvent (faster than userEvent for
 * multi-step forms in jsdom).
 */
function fillAndSubmit() {
  // Step 1
  fireEvent.change(screen.getByLabelText(/group name/i), { target: { value: 'My Savings Circle' } });
  fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'A community savings group' } });
  fireEvent.click(screen.getByRole('button', { name: /next/i }));

  // Step 2
  fireEvent.change(screen.getByLabelText(/contribution amount/i), { target: { value: '50' } });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '2592000' } });
  fireEvent.click(screen.getByRole('button', { name: /next/i }));

  // Step 3
  fireEvent.change(screen.getByLabelText(/maximum members/i), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: /next/i }));

  // Step 4 — submit
  fireEvent.click(screen.getByRole('button', { name: /create group/i }));
}

describe('Group creation flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the create group form on load', () => {
    renderPage();
    expect(screen.getByLabelText(/group name/i)).toBeInTheDocument();
  });

  it('shows validation errors for missing required fields', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/description is required/i)).toBeInTheDocument();
  });

  it('shows loading state (disabled button) while submitting', () => {
    mockCreateGroup.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();

    fillAndSubmit();

    expect(screen.getByRole('button', { name: /create group/i })).toBeDisabled();
  });

  it('shows success message after group is created', async () => {
    mockCreateGroup.mockResolvedValue('group-42');
    renderPage();

    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText(/group created successfully/i)).toBeInTheDocument();
    });
  });

  it('redirects to group detail page after success', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockCreateGroup.mockResolvedValue('group-42');
    renderPage();

    fillAndSubmit();

    await waitFor(() => screen.getByText(/group created successfully/i));

    // Flush the 2-second redirect timer from CreateGroupPage
    await vi.runAllTimersAsync();

    expect(mockNavigate).toHaveBeenCalledWith('/groups/group-42');
  });

  it('shows error message when group creation fails', async () => {
    mockCreateGroup.mockRejectedValue(new Error('Contract call failed'));
    renderPage();

    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText('Contract call failed')).toBeInTheDocument();
    });
  });

  it('calls createGroup with correct data including stroops conversion', async () => {
    mockCreateGroup.mockResolvedValue('group-1');
    renderPage();

    fillAndSubmit();

    await waitFor(() => {
      expect(mockCreateGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Savings Circle',
          contribution_amount: 500_000_000, // 50 XLM * 10_000_000
          cycle_duration: 2592000,
          max_members: 10,
        })
      );
    });
  });
});
