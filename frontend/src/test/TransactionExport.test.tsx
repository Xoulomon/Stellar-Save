import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  buildCSV,
  buildFilename,
  filterByDateRange,
} from '../hooks/useTransactionExport';
import { TransactionExportButton } from '../components/TransactionExportButton';
import type { Transaction } from '../types/transaction';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: '1',
    hash: 'abc123',
    createdAt: '2026-03-15T10:00:00Z',
    type: 'deposit',
    amount: '+100',
    assetCode: 'XLM',
    from: 'GABC',
    to: 'GDEF',
    memo: 'test memo',
    status: 'success',
    fee: '0.00001',
    ...overrides,
  };
}

const TRANSACTIONS: Transaction[] = [
  makeTx({ id: '1', createdAt: '2026-01-10T00:00:00Z', amount: '+100' }),
  makeTx({ id: '2', createdAt: '2026-02-15T00:00:00Z', amount: '-50', type: 'withdraw' }),
  makeTx({ id: '3', createdAt: '2026-03-20T00:00:00Z', amount: '+200', type: 'payment' }),
];

// ── filterByDateRange ─────────────────────────────────────────────────────────

describe('filterByDateRange', () => {
  it('returns all transactions when no dates given', () => {
    expect(filterByDateRange(TRANSACTIONS)).toHaveLength(3);
  });

  it('filters by dateFrom', () => {
    const result = filterByDateRange(TRANSACTIONS, new Date('2026-02-01'));
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['2', '3']);
  });

  it('filters by dateTo', () => {
    const result = filterByDateRange(TRANSACTIONS, undefined, new Date('2026-02-28'));
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['1', '2']);
  });

  it('filters by both dateFrom and dateTo', () => {
    const result = filterByDateRange(
      TRANSACTIONS,
      new Date('2026-02-01'),
      new Date('2026-02-28'),
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('includes transactions on the dateTo day (end of day)', () => {
    const result = filterByDateRange(
      TRANSACTIONS,
      undefined,
      new Date('2026-01-10'),
    );
    expect(result.some((t) => t.id === '1')).toBe(true);
  });

  it('returns empty array when no transactions match range', () => {
    const result = filterByDateRange(TRANSACTIONS, new Date('2027-01-01'));
    expect(result).toHaveLength(0);
  });
});

// ── buildCSV ──────────────────────────────────────────────────────────────────

describe('buildCSV', () => {
  it('includes header row', () => {
    const csv = buildCSV([]);
    expect(csv.startsWith('Date,Type,Amount,Asset,From,To,Memo,Status,Fee,Hash')).toBe(true);
  });

  it('produces one data row per transaction', () => {
    const csv = buildCSV(TRANSACTIONS);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(4); // 1 header + 3 rows
  });

  it('includes transaction fields in each row', () => {
    const csv = buildCSV([makeTx({ amount: '+100', assetCode: 'XLM', status: 'success' })]);
    expect(csv).toContain('+100');
    expect(csv).toContain('XLM');
    expect(csv).toContain('success');
  });

  it('escapes commas in field values', () => {
    const csv = buildCSV([makeTx({ memo: 'hello, world' })]);
    expect(csv).toContain('"hello, world"');
  });

  it('escapes double-quotes in field values', () => {
    const csv = buildCSV([makeTx({ memo: 'say "hi"' })]);
    expect(csv).toContain('"say ""hi"""');
  });

  it('handles large datasets (1000 rows) without error', () => {
    const large = Array.from({ length: 1000 }, (_, i) =>
      makeTx({ id: String(i), hash: `hash${i}` }),
    );
    const csv = buildCSV(large);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(1001);
  });
});

// ── buildFilename ─────────────────────────────────────────────────────────────

describe('buildFilename', () => {
  it('includes format extension', () => {
    expect(buildFilename('csv')).toMatch(/\.csv$/);
    expect(buildFilename('pdf')).toMatch(/\.pdf$/);
  });

  it('includes date range when both dates provided', () => {
    const name = buildFilename('csv', new Date('2026-01-01'), new Date('2026-03-31'));
    expect(name).toContain('2026-01-01');
    expect(name).toContain('2026-03-31');
  });

  it('includes only from date when only dateFrom provided', () => {
    const name = buildFilename('csv', new Date('2026-01-01'));
    expect(name).toContain('from_2026-01-01');
    expect(name).not.toContain('to_');
  });

  it('includes only to date when only dateTo provided', () => {
    const name = buildFilename('csv', undefined, new Date('2026-03-31'));
    expect(name).toContain('to_2026-03-31');
    expect(name).not.toContain('from_');
  });
});

// ── TransactionExportButton component ────────────────────────────────────────

describe('TransactionExportButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Export button', () => {
    render(<TransactionExportButton transactions={TRANSACTIONS} />);
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });

  it('opens export panel on click', () => {
    render(<TransactionExportButton transactions={TRANSACTIONS} />);
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    expect(screen.getByRole('dialog', { name: /export options/i })).toBeInTheDocument();
  });

  it('shows CSV and PDF format buttons', () => {
    render(<TransactionExportButton transactions={TRANSACTIONS} />);
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    // Format toggle buttons have aria-pressed
    const pressed = screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'));
    const labels = pressed.map((b) => b.textContent?.trim());
    expect(labels).toContain('CSV');
    expect(labels).toContain('PDF');
  });

  it('shows date range inputs', () => {
    render(<TransactionExportButton transactions={TRANSACTIONS} />);
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    expect(screen.getByLabelText(/from date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/to date/i)).toBeInTheDocument();
  });

  it('shows transaction count', () => {
    render(<TransactionExportButton transactions={TRANSACTIONS} />);
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    expect(screen.getByText(/3 transactions available/i)).toBeInTheDocument();
  });

  it('closes panel on Cancel', () => {
    render(<TransactionExportButton transactions={TRANSACTIONS} />);
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls exportTransactions on Download click (CSV)', () => {
    // Mock URL.createObjectURL and anchor click
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    const clickSpy = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const a = origCreate('a');
        a.click = clickSpy;
        return a;
      }
      return origCreate(tag);
    });

    render(<TransactionExportButton transactions={TRANSACTIONS} />);
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    fireEvent.click(screen.getByRole('button', { name: /download csv/i }));

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});
