import { useState } from 'react';
import { Input } from './Input';
import { Dropdown } from './Dropdown';
import { Button } from './Button';
import './GroupFilters.css';

export type GroupStatus = 'all' | 'active' | 'completed' | 'pending';
export type SortOption = 'name-asc' | 'name-desc' | 'amount-asc' | 'amount-desc' | 'members-asc' | 'members-desc' | 'date-asc' | 'date-desc';

export interface FilterState {
  status: GroupStatus;
  minAmount: string;
  maxAmount: string;
  minMembers: string;
  maxMembers: string;
  sort: SortOption;
}

interface GroupFiltersProps {
  onFilterChange: (filters: FilterState) => void;
  initialFilters?: Partial<FilterState>;
}

const defaultFilters: FilterState = {
  status: 'all',
  minAmount: '',
  maxAmount: '',
  minMembers: '',
  maxMembers: '',
  sort: 'date-desc',
};

export function GroupFilters({ onFilterChange, initialFilters }: GroupFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    ...defaultFilters,
    ...initialFilters,
  });

  const updateFilter = (key: keyof FilterState, value: string) => {
    const updated = { ...filters, [key]: value };
    setFilters(updated);
    onFilterChange(updated);
  };

  const reset = () => {
    setFilters(defaultFilters);
    onFilterChange(defaultFilters);
  };

  const statusItems = [
    { id: 'all', label: 'All Groups', onClick: () => updateFilter('status', 'all') },
    { id: 'active', label: 'Active', onClick: () => updateFilter('status', 'active') },
    { id: 'completed', label: 'Completed', onClick: () => updateFilter('status', 'completed') },
    { id: 'pending', label: 'Pending', onClick: () => updateFilter('status', 'pending') },
  ];

  const sortItems = [
    { id: 'name-asc', label: 'Name (A-Z)', onClick: () => updateFilter('sort', 'name-asc') },
    { id: 'name-desc', label: 'Name (Z-A)', onClick: () => updateFilter('sort', 'name-desc') },
    { id: 'amount-asc', label: 'Amount (Low-High)', onClick: () => updateFilter('sort', 'amount-asc') },
    { id: 'amount-desc', label: 'Amount (High-Low)', onClick: () => updateFilter('sort', 'amount-desc') },
    { id: 'members-asc', label: 'Members (Low-High)', onClick: () => updateFilter('sort', 'members-asc') },
    { id: 'members-desc', label: 'Members (High-Low)', onClick: () => updateFilter('sort', 'members-desc') },
    { id: 'date-asc', label: 'Date (Oldest)', onClick: () => updateFilter('sort', 'date-asc') },
    { id: 'date-desc', label: 'Date (Newest)', onClick: () => updateFilter('sort', 'date-desc') },
  ];

  const getStatusLabel = () => statusItems.find(i => i.id === filters.status)?.label || 'All Groups';
  const getSortLabel = () => sortItems.find(i => i.id === filters.sort)?.label || 'Date (Newest)';

  return (
    <div className="group-filters">
      <div className="group-filters-row">
        <Dropdown
          trigger={<button className="filter-button">Status: {getStatusLabel()}</button>}
          items={statusItems}
          position="bottom-start"
        />
        
        <Dropdown
          trigger={<button className="filter-button">Sort: {getSortLabel()}</button>}
          items={sortItems}
          position="bottom-start"
        />

        <Button variant="ghost" size="small" onClick={reset}>
          Reset
        </Button>
      </div>

      <div className="group-filters-row">
        <div className="filter-range">
          <label>Contribution Amount</label>
          <div className="filter-inputs">
            <Input
              type="number"
              placeholder="Min"
              value={filters.minAmount}
              onChange={(e) => updateFilter('minAmount', e.target.value)}
            />
            <span>-</span>
            <Input
              type="number"
              placeholder="Max"
              value={filters.maxAmount}
              onChange={(e) => updateFilter('maxAmount', e.target.value)}
            />
          </div>
        </div>

        <div className="filter-range">
          <label>Member Count</label>
          <div className="filter-inputs">
            <Input
              type="number"
              placeholder="Min"
              value={filters.minMembers}
              onChange={(e) => updateFilter('minMembers', e.target.value)}
            />
            <span>-</span>
            <Input
              type="number"
              placeholder="Max"
              value={filters.maxMembers}
              onChange={(e) => updateFilter('maxMembers', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
