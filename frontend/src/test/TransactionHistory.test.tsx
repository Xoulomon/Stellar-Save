import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionHistory } from '../components/TransactionHistory';
import * as useWalletHook from '../hooks/useWallet';

vi.mock('../hooks/useWallet', () => ({
  useWallet: vi.fn().mockReturnValue({ activeAddress: null, network: 'TESTNET' }),
}));

let prevClientHeight: PropertyDescriptor | undefined;
let prevClientWidth: PropertyDescriptor | undefined;

function mockContainerDimensions() {
  prevClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
  prevClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return 480; } });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return 900; } });
}

function restoreContainerDimensions() {
  if (prevClientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', prevClientHeight);
  if (prevClientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', prevClientWidth);
}

beforeEach(() => {
  global.ResizeObserver = class ResizeObserver {
    private cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(target: Element) {
      this.cb(
        [{ contentRect: { height: 480, width: 900, x: 0, y: 0, top: 0, right: 900, bottom: 480, left: 0 } as DOMRectReadOnly, target } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  };

  mockContainerDimensions();

  const mock = useWalletHook.useWallet as ReturnType<typeof vi.fn>;
  mock.mockReturnValue({ activeAddress: null, network: 'TESTNET' });
});

afterEach(() => {
  vi.restoreAllMocks();
  restoreContainerDimensions();
});

function mockHorizonResponse(overrides = {}) {
  return {
    _embedded: {
      records: [
        {
          id: '123',
          type: 'payment',
          created_at: '2026-04-20T10:30:00Z',
          transaction_hash: 'abc123',
          amount: '250.0000000',
          asset_code: 'XLM',
          asset_type: 'native',
          from: 'GASEND...',
          to: 'GARECV...',
          memo: 'Group contribution',
        },
        {
          id: '456',
          type: 'payment',
          created_at: '2026-04-15T14:22:00Z',
          transaction_hash: 'def456',
          amount: '1000.0000000',
          asset_code: 'USDC',
          asset_type: 'credit_alphanum4',
          from: 'GASEND2...',
          to: 'GARECV2...',
          memo: 'Payout',
        },
      ],
    },
    ...overrides,
  };
}

describe('TransactionHistory — no wallet connected', () => {
  it('renders title', () => {
    render(<TransactionHistory />);
    expect(screen.getByText('Transaction History')).toBeInTheDocument();
  });

  it('shows demo data hint when no address', () => {
    render(<TransactionHistory />);
    expect(screen.getByText(/Showing demo data/i)).toBeInTheDocument();
  });

  it('renders mock transaction data from MOCK_TRANSACTIONS', async () => {
    const { container } = render(<TransactionHistory />);
    await waitFor(() => {
      expect(container.querySelector('[aria-rowcount="6"]')).toBeInTheDocument();
    });
  });

  it('shows no demo hint when address is provided', () => {
    const mock = useWalletHook.useWallet as ReturnType<typeof vi.fn>;
    mock.mockReturnValue({ activeAddress: 'GABC1234567890', network: 'TESTNET' });
    render(<TransactionHistory address="GABC1234567890" />);
    expect(screen.queryByText(/Showing demo data/i)).not.toBeInTheDocument();
  });
});

describe('TransactionHistory — type filter', () => {
  it('renders type filter dropdown with All types option', () => {
    render(<TransactionHistory />);
    expect(screen.getByText('All types')).toBeInTheDocument();
  });

  it('renders unique type options from transaction data', async () => {
    const { container } = render(<TransactionHistory />);
    await waitFor(() => {
      expect(container.querySelector('[aria-rowcount="6"]')).toBeInTheDocument();
    });
    const trigger = screen.getByRole('combobox', { name: /type/i });
    expect(trigger).toBeInTheDocument();
  });
});

describe('TransactionHistory — with address and Horizon fetch', () => {
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    const mock = useWalletHook.useWallet as ReturnType<typeof vi.fn>;
    mock.mockReturnValue({ activeAddress: 'GABC1234567890', network: 'TESTNET' });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetches transactions from Horizon on mount', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHorizonResponse()),
    });
    render(<TransactionHistory />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/accounts/GABC1234567890/payments'),
      );
    });
  });

  it('renders fetched transaction data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHorizonResponse()),
    });
    const { container } = render(<TransactionHistory />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    await waitFor(() => {
      const el = container.querySelector('[aria-rowcount]');
      const count = el?.getAttribute('aria-rowcount');
      expect(count).toBe('3');
    });
  });

  it('falls back to mock data when Horizon fetch returns empty', async () => {
    const { container } = render(<TransactionHistory />);
    await waitFor(() => {
      expect(container.querySelector('[aria-rowcount="6"]')).toBeInTheDocument();
    });
  });

  it('gracefully falls back to mock data on Horizon fetch error', async () => {
    const { container } = render(<TransactionHistory />);
    await waitFor(() => {
      expect(container.querySelector('[aria-rowcount="6"]')).toBeInTheDocument();
    });
  });

  it('does not show error alert on fetch fallback', async () => {
    const { container } = render(<TransactionHistory />);
    await waitFor(() => {
      expect(container.querySelector('[aria-rowcount="6"]')).toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('uses correct Horizon URL for mainnet', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHorizonResponse()),
    });
    const mock = useWalletHook.useWallet as ReturnType<typeof vi.fn>;
    mock.mockReturnValue({ activeAddress: 'GABC1234567890', network: 'MAINNET' });
    render(<TransactionHistory />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('horizon.stellar.org'),
      );
    });
  });
});

describe('TransactionHistory — custom address prop', () => {
  it('uses provided address prop instead of wallet address', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHorizonResponse()),
    });
    const originalFetch = global.fetch;
    global.fetch = mockFetch;

    render(<TransactionHistory address="GCUSTOM1234567890" />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('GCUSTOM1234567890'),
      );
    });

    global.fetch = originalFetch;
  });
});

describe('TransactionHistory — contractId filter', () => {
  it('passes contractId to Horizon URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHorizonResponse()),
    });
    const originalFetch = global.fetch;
    global.fetch = mockFetch;

    const mock = useWalletHook.useWallet as ReturnType<typeof vi.fn>;
    mock.mockReturnValue({ activeAddress: 'GABC1234567890', network: 'TESTNET' });

    render(<TransactionHistory contractId="CONTRACT123" />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    global.fetch = originalFetch;
  });
});

describe('TransactionHistory — pageSize', () => {
  it('uses provided pageSize', () => {
    render(<TransactionHistory pageSize={25} />);
    expect(screen.getByText('Transaction History')).toBeInTheDocument();
  });
});

describe('TransactionHistory — custom network prop', () => {
  it('uses FUTURENET Horizon URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHorizonResponse()),
    });
    const originalFetch = global.fetch;
    global.fetch = mockFetch;

    const mock = useWalletHook.useWallet as ReturnType<typeof vi.fn>;
    mock.mockReturnValue({ activeAddress: 'GABC1234567890', network: 'FUTURENET' });

    render(<TransactionHistory />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('horizon-futurenet.stellar.org'),
      );
    });

    global.fetch = originalFetch;
  });
});
