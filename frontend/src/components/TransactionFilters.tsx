import React from 'react';
import type { TransactionFilters as FilterType, TransactionType } from '../types/transaction';
import { Badge } from './Badge';

interface Props {
  filters: FilterType;
  onChange: (filters: FilterType) => void;
}

const TransactionFilters: React.FC<Props> = ({ filters, onChange }) => {
  const types: TransactionType[] = ['deposit', 'withdraw', 'payment', 'swap', 'claimable'];
  const statuses = ['success', 'pending', 'failed'] as const;

  const toggleType = (type: TransactionType) => {
    const current = filters.type || [];
    const newTypes = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];

    onChange({ ...filters, type: newTypes });
  };

  const toggleStatus = (status: 'success' | 'pending' | 'failed') => {
    const current = filters.status || [];
    const newStatuses = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];

    onChange({ ...filters, status: newStatuses });
  };

  return (
    <div className="flex flex-wrap gap-4 bg-gray-900 p-4 rounded-xl border border-gray-800">
      <div>
        <p className="text-sm text-gray-400 mb-2">Type</p>
        <div className="flex flex-wrap gap-2">
          {types.map((t) => {
            const isActive = filters.type?.includes(t) || false;
            return (
              <div
                key={t}
                onClick={() => toggleType(t)}
                className="cursor-pointer"
              >
                <Badge variant={isActive ? 'primary' : 'secondary'}>
                  {t}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-sm text-gray-400 mb-2">Status</p>
        <div className="flex gap-2">
          {statuses.map((s) => {
            const isActive = filters.status?.includes(s) || false;
            return (
              <div
                key={s}
                onClick={() => toggleStatus(s)}
                className="cursor-pointer"
              >
                <Badge variant={isActive ? 'success' : 'secondary'}>
                  {s}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TransactionFilters;