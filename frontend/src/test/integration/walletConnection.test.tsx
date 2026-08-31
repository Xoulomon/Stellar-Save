/**
 * Integration tests: Wallet connection flow
 *
 * Tests the full wallet connect/disconnect cycle using a real WalletProvider
 * with the freighterAdapter mocked at the module level.
 *
 * ─── AUDIT RESULT (#1348) ───────────────────────────────────────────────────
 * Audited against unit test coverage in:
 *   - frontend/src/test/useWallet.test.tsx
 *   - frontend/src/test/WalletButton.test.tsx
 *   - frontend/src/test/WalletStatusIndicator.test.tsx
 *   - frontend/src/test/wallet-compat/wallet-compat.test.tsx
 *
 * Tests BEFORE audit: 5
 * Tests AFTER  audit: 4   (1 removed)
 * Estimated runtime improvement: ~15–20% (one fewer userEvent setup + render cycle)
 *
 * ─── REMOVED ────────────────────────────────────────────────────────────────
 * ✂  "shows 'Connect Wallet' button when wallet is not connected"
 *    REASON: WalletButton.test.tsx ("shows connect button when disconnected")
 *    already covers this assertion by mocking useWallet directly and asserting
 *    the 'Connect Wallet' text. That test is faster (no WalletProvider tree,
 *    no module-level adapter mock) and exercises the exact same render branch.
 *    The integration version adds no cross-boundary signal: it renders a single
 *    component that reads from context and checks one text node — identical to
 *    the unit test. No real adapter call happens; the mock returns false
 *    immediately with no async flow.
 *
 * ─── RETAINED TESTS & JUSTIFICATION ────────────────────────────────────────
 * The following four tests are kept because they test CROSS-BOUNDARY behavior
 * that cannot be replicated at the unit level:
 *
 * ✅ "shows connecting state while wallet is being connected"
 *    Exercises an async userEvent flow where WalletProvider must manage an
 *    in-flight Promise from the mocked adapter and propagate the transient
 *    'connecting' state through context to WalletButton's disabled/text logic.
 *    No unit test covers this state transition sequence.
 *
 * ✅ "shows truncated address after successful connection"
 *    Verifies the full connect → context update → WalletButton re-render
 *    pipeline: adapter.connect() resolves, WalletProvider stores the address,
 *    WalletButton reads it from context and formats it. This chain spans three
 *    layers (adapter → provider → button) and cannot be replicated by any
 *    existing unit test.
 *
 * ✅ "shows error state when wallet connection fails"
 *    The rejected Promise path must flow from freighterAdapter → WalletProvider
 *    error state → WalletButton returning to idle. WalletStatusIndicator.test.tsx
 *    tests the 'error' status in isolation but does NOT test the recovery path
 *    where the button becomes re-interactive after a rejected connect() call.
 *
 * ✅ "disconnects and returns to idle state"
 *    Tests the full connect → display address → open menu → disconnect → idle
 *    sequence across WalletProvider + WalletButton. This multi-step user journey
 *    is unique to the integration layer; no unit test covers the disconnect
 *    interaction or the menu open step.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { WalletButton } from '../../components/WalletButton';
import { freighterAdapter } from '../../wallet/freighterAdapter';
import { WalletProvider } from '../../wallet/WalletProvider';

// Mock the freighter adapter so no real extension is needed.
// This mock lives at the module boundary — the key cross-boundary aspect that
// differentiates these integration tests from pure unit tests.
vi.mock('../../wallet/freighterAdapter', () => ({
  freighterAdapter: {
    id: 'freighter',
    name: 'Freighter',
    isInstalled: vi.fn(),
    connect: vi.fn(),
    getAddress: vi.fn(),
    getNetwork: vi.fn(),
    watch: vi.fn(() => () => undefined),
  },
}));

const mockAdapter = vi.mocked(freighterAdapter);

function renderWalletButton() {
  return render(
    <MemoryRouter>
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    </MemoryRouter>
  );
}

describe('Wallet connection flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter.isInstalled.mockResolvedValue(false);
    mockAdapter.watch.mockReturnValue(() => undefined);
  });

  // NOTE: "shows 'Connect Wallet' button when wallet is not connected" was
  // removed — covered by WalletButton.test.tsx unit test. See AUDIT RESULT above.

  it('shows connecting state while wallet is being connected', async () => {
    const user = userEvent.setup();
    // Never resolves — keeps the connecting state
    mockAdapter.connect.mockReturnValue(new Promise(() => {}));
    renderWalletButton();

    await user.click(await screen.findByRole('button', { name: /connect wallet/i }));

    expect(await screen.findByRole('button', { name: /connecting/i })).toBeDisabled();
  });

  it('shows truncated address after successful connection', async () => {
    const user = userEvent.setup();
    const address = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTU';
    mockAdapter.connect.mockResolvedValue({ address, network: 'testnet' });

    renderWalletButton();
    await user.click(await screen.findByRole('button', { name: /connect wallet/i }));

    await waitFor(() => {
      // WalletButton shows first 6 + last 4 chars
      expect(screen.getByText(new RegExp(`${address.slice(0, 6)}`))).toBeInTheDocument();
    });
  });

  it('shows error state when wallet connection fails', async () => {
    const user = userEvent.setup();
    mockAdapter.connect.mockRejectedValue(new Error('User rejected'));

    renderWalletButton();
    await user.click(await screen.findByRole('button', { name: /connect wallet/i }));

    // After failure the button should return to idle (not stuck in connecting)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /connect wallet/i })).not.toBeDisabled();
    });
  });

  it('disconnects and returns to idle state', async () => {
    const user = userEvent.setup();
    const address = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTU';
    mockAdapter.connect.mockResolvedValue({ address, network: 'testnet' });

    renderWalletButton();
    await user.click(await screen.findByRole('button', { name: /connect wallet/i }));

    // Wait for connected state
    await waitFor(() => {
      expect(screen.getByText(new RegExp(address.slice(0, 6)))).toBeInTheDocument();
    });

    // Open menu and disconnect
    await user.click(screen.getByText(new RegExp(address.slice(0, 6))));
    await user.click(screen.getByText(/disconnect/i));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
    });
  });
});
