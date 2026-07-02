import { useState } from 'react';
import type { DetailedGroup } from '../utils/groupApi';
import { useGroupReportExport } from '../hooks/useGroupReportExport';

interface Props {
  group: DetailedGroup;
}

export function GroupReportExportButton({ group }: Props) {
  const { exportReport } = useGroupReportExport(group);
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv');
  const [open, setOpen] = useState(false);

  const handleExport = () => {
    exportReport({ format });
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="btn btn-secondary btn-md"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="group-report-export-dialog"
      >
        Download Report
      </button>

      {open && (
        <div
          id="group-report-export-dialog"
          role="dialog"
          aria-label="Download group financial report"
          aria-modal="true"
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
            Export Group Report
          </p>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 0.75rem' }}>
            {group.name}
          </p>

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

          <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 0.25rem' }}>
            {format === 'csv'
              ? `CSV includes ${group.contributions.length} contribution record(s).`
              : 'PDF includes pool totals, member status, and cycle history.'}
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleExport}
              aria-label={`Download group report as ${format.toUpperCase()}`}
            >
              Download {format.toUpperCase()}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
