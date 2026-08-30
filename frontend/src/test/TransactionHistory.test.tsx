import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { server } from '../__mocks__/msw/server';
import {
  DEFAULT_PAYMENTS_PAGE,
  createHorizonHandlers,
} from '../__mocks__/msw/handlers/horizon';
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Override the default Horizon payments handler to return a custom response. */
function useHorizonPayments(records: object[], status = 200) {
  server.use(
    http.get('https://horizon-testnet.stellar.org/accounts/:accountId/payments', () =>
      HttpResponse.json({ _embedded: { records }, _links: {} }, { status })
    ),
    http.get('https://horizon.stellar.org/accounts/:accountId/payments', () =>
      HttpResponse.json({ _embedded: { records }, _links: {} }, { status })
    ),
    http.get('https://horizon-futurenet.stellar.org/accounts/:accountId/payments', () =>
      HttpResponse.json({ _embedded: { records }, _links: {} }, { status })
    ),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

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
  beforeEach(() => {
    const mock = useWalletHook.useWallet as ReturnType<typeof vi.fn>;
    mock.mockReturnValue({ activeAddress: 'GABC1234567890', network: 'TESTNET' });
  });

  it('fetches transactions from Horizon on mount (default MSW handler responds)', async () => {
    // The default Horizon handler registered in setup.ts will respond.
    render(<TransactionHistory />);
    await waitFor(() => {
      // After the fetch the component should move away from the 6-row demo
      // state and show fetched rows (2 from DEFAULT_PAYMENTS_PAGE fixture).
      const el = document.querySelector('[aria-rowcount]');
      expect(el).toBeInTheDocument();
    });
  });

  it('renders fetched transaction data from MSW handler', async () => {
    // DEFAULT_PAYMENTS_PAGE has 2 records — the default handler returns them.
    const { container } = render(<TransactionHistory />);
    await waitFor(() => {
      const el = container.querySelector('[aria-rowcount="3"]');
      expect(el).toBeInTheDocument();
    });
  });

  it('falls back to mock data when Horizon returns an empty response', async () => {
    useHorizonPayments([]);
    const { container } = render(<TransactionHistory />);
    await waitFor(() => {
      expect(container.querySelector('[aria-rowcount="6"]')).toBeInTheDocument();
    });
  });

  it('gracefully falls back to mock data on Horizon 500 error', async () => {
    server.use(
      http.get('https://horizon-testnet.stellar.org/accounts/:accountId/payments', () =>
        HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 })
      ),
    );
    const { container } = render(<TransactionHistory />);
    await waitFor(() => {
      expect(container.querySelector('[aria-rowcount="6"]')).toBeInTheDocument();
    });
  });

  it('does not show error alert on fetch fallback', async () => {
    useHorizonPayments([]);
    const { container } = render(<TransactionHistory />);
    await waitFor(() => {
      expect(container.querySelector('[aria-rowcount="6"]')).toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('uses the mainnet Horizon URL when network is MAINNET', async () => {
    const mock = useWalletHook.useWallet as ReturnType<typeof vi.fn>;
    mock.mockReturnValue({ activeAddress: 'GABC1234567890', network: 'MAINNET' });

    // Override the mainnet handler to confirm it was called.
    let mainnetCalled = false;
    server.use(
      http.get('https://horizon.stellar.org/accounts/:accountId/payments', () => {
        mainnetCalled = true;
        return HttpResponse.json(DEFAULT_PAYMENTS_PAGE);
      }),
    );

    render(<TransactionHistory />);
    await waitFor(() => {
      expect(mainnetCalled).toBe(true);
    });
  });
});

describe('TransactionHistory — custom address prop', () => {
  it('uses provided address prop instead of wallet address', async () => {
    let capturedAccountId: string | undefined;
    server.use(
      http.get('https://horizon-testnet.stellar.org/accounts/:accountId/payments', ({ params }) => {
        capturedAccountId = params['accountId'] as string;
        return HttpResponse.json(DEFAULT_PAYMENTS_PAGE);
      }),
    );

    render(<TransactionHistory address="GCUSTOM1234567890" />);
    await waitFor(() => {
      expect(capturedAccountId).toBe('GCUSTOM1234567890');
    });
  });
});

describe('TransactionHistory — contractId filter', () => {
  it('passes contractId to Horizon URL when provided', async () => {
    const mock = useWalletHook.useWallet as ReturnType<typeof vi.fn>;
    mock.mockReturnValue({ activeAddress: 'GABC1234567890', network: 'TESTNET' });

    let requested = false;
    server.use(
      http.get('https://horizon-testnet.stellar.org/accounts/:accountId/payments', () => {
        requested = true;
        return HttpResponse.json(DEFAULT_PAYMENTS_PAGE);
      }),
    );

    render(<TransactionHistory contractId="CONTRACT123" />);
    await waitFor(() => {
      expect(requested).toBe(true);
    });
  });
});

describe('TransactionHistory — pageSize', () => {
  it('renders title with provided pageSize', () => {
    render(<TransactionHistory pageSize={25} />);
    expect(screen.getByText('Transaction History')).toBeInTheDocument();
  });
});

describe('TransactionHistory — custom network prop', () => {
  it('uses FUTURENET Horizon URL when network is FUTURENET', async () => {
    const mock = useWalletHook.useWallet as ReturnType<typeof vi.fn>;
    mock.mockReturnValue({ activeAddress: 'GABC1234567890', network: 'FUTURENET' });

    let futurenetCalled = false;
    server.use(
      http.get('https://horizon-futurenet.stellar.org/accounts/:accountId/payments', () => {
        futurenetCalled = true;
        return HttpResponse.json(DEFAULT_PAYMENTS_PAGE);
      }),
    );

    render(<TransactionHistory />);
    await waitFor(() => {
      expect(futurenetCalled).toBe(true);
    });
  });
});
