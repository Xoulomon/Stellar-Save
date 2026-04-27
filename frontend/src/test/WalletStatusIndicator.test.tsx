import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { WalletStatusIndicator } from '../components/WalletStatusIndicator';
import * as useWalletHook from '../hooks/useWallet';
import * as useClipboardHook from '../hooks/useClipboard';
import { WalletProvider } from '../wallet/WalletProvider';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../hooks/useWallet');
vi.mock('../hooks/useClipboard');

// Mock fetch for latency testing
const originalFetch = global.fetch;
const mockFetch = vi.fn();

beforeEach(() => {
  global.fetch = mockFetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.clearAllMocks();
});

describe('WalletStatusIndicator', () => {
  it('shows disconnected state when wallet is idle', () => {
    vi.spyOn(useWalletHook, 'useWallet').mockReturnValue({
      status: 'idle',
      activeAddress: null,
      network: null,
      error: null,
      wallets: [],
      selectedWalletId: '',
      connectedAccounts: [],
      refreshWallets: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchWallet: vi.fn(),
      switchAccount: vi.fn(),
    });

    vi.spyOn(useClipboardHook, 'useClipboard').mockReturnValue({
      copy: vi.fn(),
      copied: false,
    });

    render(<WalletStatusIndicator />);
    expect(screen.getByText('Wallet disconnected')).toBeInTheDocument();
  });

  it('shows connecting state', () => {
    vi.spyOn(useWalletHook, 'useWallet').mockReturnValue({
      status: 'connecting',
      activeAddress: null,
      network: null,
      error: null,
      wallets: [],
      selectedWalletId: '',
      connectedAccounts: [],
      refreshWallets: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchWallet: vi.fn(),
      switchAccount: vi.fn(),
    });

    vi.spyOn(useClipboardHook, 'useClipboard').mockReturnValue({
      copy: vi.fn(),
      copied: false,
    });

    render(<WalletStatusIndicator />);
    expect(screen.getByText('Connecting wallet...')).toBeInTheDocument();
  });

  it('shows error state with error message', () => {
    const errorMessage = 'Connection failed';
    vi.spyOn(useWalletHook, 'useWallet').mockReturnValue({
      status: 'error',
      activeAddress: null,
      network: null,
      error: errorMessage,
      wallets: [],
      selectedWalletId: '',
      connectedAccounts: [],
      refreshWallets: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchWallet: vi.fn(),
      switchAccount: vi.fn(),
    });

    vi.spyOn(useClipboardHook, 'useClipboard').mockReturnValue({
      copy: vi.fn(),
      copied: false,
    });

    render(<WalletStatusIndicator />);
    expect(screen.getByText('Connection error')).toBeInTheDocument();
  });

  it('shows connected state with network and address', async () => {
    const address = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    const network = 'testnet';

    vi.spyOn(useWalletHook, 'useWallet').mockReturnValue({
      status: 'connected',
      activeAddress: address,
      network,
      error: null,
      wallets: [],
      selectedWalletId: '',
      connectedAccounts: [],
      refreshWallets: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchWallet: vi.fn(),
      switchAccount: vi.fn(),
    });

    const mockCopy = vi.fn();
    vi.spyOn(useClipboardHook, 'useClipboard').mockReturnValue({
      copy: mockCopy,
      copied: false,
    });

    // Mock successful fetch with latency
    mockFetch.mockResolvedValue({
      ok: true,
    });

    render(<WalletStatusIndicator />);

    // Check network chip
    expect(screen.getByText(network)).toBeInTheDocument();

    // Check truncated address
    expect(screen.getByText('GABCDEF…567890')).toBeInTheDocument();

    // Wait for latency measurement
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('https://horizon-testnet.stellar.org/');
    });
  });

  it('shows excellent connection strength for low latency', async () => {
    const address = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    const network = 'mainnet';

    vi.spyOn(useWalletHook, 'useWallet').mockReturnValue({
      status: 'connected',
      activeAddress: address,
      network,
      error: null,
      wallets: [],
      selectedWalletId: '',
      connectedAccounts: [],
      refreshWallets: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchWallet: vi.fn(),
      switchAccount: vi.fn(),
    });

    vi.spyOn(useClipboardHook, 'useClipboard').mockReturnValue({
      copy: vi.fn(),
      copied: false,
    });

    // Mock fast response (100ms latency)
    mockFetch.mockImplementation(() => {
      return new Promise(resolve => {
        setTimeout(() => resolve({ ok: true }), 100);
      });
    });

    render(<WalletStatusIndicator />);

    // Wait for latency to be measured and displayed
    await waitFor(() => {
      expect(screen.getByText(/ms/)).toBeInTheDocument();
    });
  });

  it('shows offline when fetch fails', async () => {
    const address = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    const network = 'mainnet';

    vi.spyOn(useWalletHook, 'useWallet').mockReturnValue({
      status: 'connected',
      activeAddress: address,
      network,
      error: null,
      wallets: [],
      selectedWalletId: '',
      connectedAccounts: [],
      refreshWallets: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchWallet: vi.fn(),
      switchAccount: vi.fn(),
    });

    vi.spyOn(useClipboardHook, 'useClipboard').mockReturnValue({
      copy: vi.fn(),
      copied: false,
    });

    // Mock failed fetch
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(<WalletStatusIndicator />);

    // Should show offline state
    await waitFor(() => {
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  it('copies address when copy button is clicked', async () => {
    const user = userEvent.setup();
    const address = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    const network = 'testnet';

    vi.spyOn(useWalletHook, 'useWallet').mockReturnValue({
      status: 'connected',
      activeAddress: address,
      network,
      error: null,
      wallets: [],
      selectedWalletId: '',
      connectedAccounts: [],
      refreshWallets: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchWallet: vi.fn(),
      switchAccount: vi.fn(),
    });

    const mockCopy = vi.fn();
    vi.spyOn(useClipboardHook, 'useClipboard').mockReturnValue({
      copy: mockCopy,
      copied: false,
    });

    mockFetch.mockResolvedValue({ ok: true });

    render(<WalletStatusIndicator />);

    const copyButton = screen.getByRole('button', { name: /copy address/i });
    await user.click(copyButton);

    expect(mockCopy).toHaveBeenCalledWith(address);
  });

  it('shows copied state after copying', () => {
    const address = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    const network = 'testnet';

    vi.spyOn(useWalletHook, 'useWallet').mockReturnValue({
      status: 'connected',
      activeAddress: address,
      network,
      error: null,
      wallets: [],
      selectedWalletId: '',
      connectedAccounts: [],
      refreshWallets: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchWallet: vi.fn(),
      switchAccount: vi.fn(),
    });

    vi.spyOn(useClipboardHook, 'useClipboard').mockReturnValue({
      copy: vi.fn(),
      copied: true,
    });

    mockFetch.mockResolvedValue({ ok: true });

    render(<WalletStatusIndicator />);

    // Should show check icon when copied
    expect(screen.getByTestId('CheckCircleIcon')).toBeInTheDocument();
  });
});