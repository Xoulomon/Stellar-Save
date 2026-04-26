import { useState } from 'react';
import type { Transaction } from '../types/transaction';
import { useTransactionExport } from '../hooks/useTransactionExport';

interface Props {
  transactions: Transaction[];
}

export function TransactionExportButton({ transactions }: Props) {
  const { exportTransactions } = useTransactionExport(transactions);
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [open, setOpen] = useState(false);

  const handleExport = () => {
    exportTransactions({
      format,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    });
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="btn btn-secondary btn-md"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Export
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Export options"
          style={{
            position: 'absolute',
            right: 0,
            top: '110%',
            background: 'var(--color-bg, #1a1a1a)',
            border: '1px solid var(--color-border, #444)',
            borderRadius: 8,
            padding: '1rem',
            minWidth: 260,
            zIndex: 100,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <p style={{ margin: '0 0 0.75rem', fontWeight: 600, fontSize: '0.9rem' }}>
            Export Transactions
          </p>

          {/* Format */}
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', color: '#9ca3af' }}>
            Format
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {(['csv', 'pdf'] as const).map((f) => (
              <button
                key={f}
                className={`btn btn-${format === f ? 'primary' : 'secondary'} btn-sm`}
                onClick={() => setFormat(f)}
                aria-pressed={format === f}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Date range */}
          <label htmlFor="export-date-from" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem', color: '#9ca3af' }}>
            From date
          </label>
          <input
            id="export-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ width: '100%', marginBottom: '0.5rem', padding: '0.4rem', borderRadius: 4, border: '1px solid #444', background: '#111', color: '#fff', boxSizing: 'border-box' }}
          />

          <label htmlFor="export-date-to" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem', color: '#9ca3af' }}>
            To date
          </label>
          <input
            id="export-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ width: '100%', marginBottom: '0.75rem', padding: '0.4rem', borderRadius: 4, border: '1px solid #444', background: '#111', color: '#fff', boxSizing: 'border-box' }}
          />

          <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 0.75rem' }}>
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} available
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleExport} aria-label={`Download ${format.toUpperCase()}`}>
              Download {format.toUpperCase()}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
