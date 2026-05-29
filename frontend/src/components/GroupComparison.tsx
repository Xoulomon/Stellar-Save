import { useState } from 'react';
import type { PublicGroup } from '../types/group';
import { Button } from './Button';
import { GroupBadge } from './GroupBadge';
import './GroupComparison.css';

const MAX_GROUPS = 3;

interface GroupComparisonProps {
  availableGroups: PublicGroup[];
}

type MetricKey = 'memberCount' | 'contributionAmount' | 'status';

const METRICS: { key: MetricKey; label: string }[] = [
  { key: 'memberCount', label: 'Members' },
  { key: 'contributionAmount', label: 'Contribution (XLM)' },
  { key: 'status', label: 'Status' },
];

function getBest(groups: PublicGroup[], key: MetricKey): string | null {
  if (key === 'memberCount') {
    const max = Math.max(...groups.map((g) => g.memberCount));
    return String(max);
  }
  if (key === 'contributionAmount') {
    const min = Math.min(...groups.map((g) => g.contributionAmount));
    return String(min);
  }
  return null;
}

function formatValue(group: PublicGroup, key: MetricKey): string {
  if (key === 'contributionAmount') return `${group.contributionAmount.toLocaleString()} ${group.currency}`;
  if (key === 'memberCount') return String(group.memberCount);
  return group.status;
}

export function GroupComparison({ availableGroups }: GroupComparisonProps) {
  const [selected, setSelected] = useState<PublicGroup[]>([]);

  const toggle = (group: PublicGroup) => {
    setSelected((prev) => {
      if (prev.find((g) => g.id === group.id)) return prev.filter((g) => g.id !== group.id);
      if (prev.length >= MAX_GROUPS) return prev;
      return [...prev, group];
    });
  };

  const handleExport = () => window.print();

  return (
    <div className="group-comparison">
      {/* Group selector */}
      <section className="gc-selector" aria-label="Select groups to compare">
        <p className="gc-selector-hint">Select up to {MAX_GROUPS} groups to compare</p>
        <ul className="gc-selector-list" role="list">
          {availableGroups.map((group) => {
            const isSelected = !!selected.find((g) => g.id === group.id);
            const isDisabled = !isSelected && selected.length >= MAX_GROUPS;
            return (
              <li key={group.id}>
                <button
                  className={`gc-selector-item${isSelected ? ' gc-selector-item--selected' : ''}`}
                  onClick={() => toggle(group)}
                  disabled={isDisabled}
                  aria-pressed={isSelected}
                  aria-label={`${isSelected ? 'Deselect' : 'Select'} ${group.name}`}
                >
                  {group.name}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Comparison table */}
      {selected.length > 0 && (
        <section className="gc-table-section" aria-label="Group comparison table">
          <div className="gc-table-wrapper">
            <table className="gc-table">
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  {selected.map((g) => (
                    <th key={g.id} scope="col">
                      {g.name}
                      <button
                        className="gc-remove-btn"
                        onClick={() => toggle(g)}
                        aria-label={`Remove ${g.name} from comparison`}
                      >
                        ✕
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map(({ key, label }) => {
                  const best = getBest(selected, key);
                  return (
                    <tr key={key}>
                      <th scope="row">{label}</th>
                      {selected.map((g) => {
                        const raw = key === 'memberCount' ? String(g.memberCount) : key === 'contributionAmount' ? String(g.contributionAmount) : null;
                        const isBest = best !== null && raw === best;
                        return (
                          <td
                            key={g.id}
                            className={isBest ? 'gc-cell--best' : undefined}
                            aria-label={isBest ? `${label}: ${formatValue(g, key)} (best)` : undefined}
                          >
                            {key === 'status' ? (
                              <GroupBadge status={g.status} />
                            ) : (
                              formatValue(g, key)
                            )}
                            {isBest && <span className="gc-best-badge" aria-hidden="true">★</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="gc-actions">
            <Button variant="secondary" size="sm" onClick={handleExport} aria-label="Export comparison">
              Export / Print
            </Button>
          </div>
        </section>
      )}

      {selected.length === 0 && (
        <p className="gc-empty" role="status">Select at least one group above to start comparing.</p>
      )}
    </div>
  );
}
