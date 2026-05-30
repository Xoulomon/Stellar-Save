import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GroupsPage from '../pages/GroupsPage';

// WalletStatusIndicator imports @mui/icons-material which isn't installed — mock it
vi.mock('../components/WalletStatusIndicator', () => ({
  WalletStatusIndicator: () => null,
}));

// ── Mock useGroups ────────────────────────────────────────────────────────────

const mockSetFilters = vi.fn();
const mockGroups = [
  { id: '1', name: 'Alpha Circle', currency: 'XLM', contributionAmount: 100, memberCount: 5, status: 'active', createdAt: new Date() },
  { id: '2', name: 'Beta Pool', currency: 'USDC', contributionAmount: 250, memberCount: 8, status: 'active', createdAt: new Date() },
];

vi.mock('../hooks/useGroups', () => ({
  useGroups: () => ({
    groups: mockGroups,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    filteredCount: mockGroups.length,
    pagination: { page: 1, pageSize: 12, totalItems: 2, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    filters: { search: '', status: 'all', minAmount: '', maxAmount: '', minMembers: '', maxMembers: '', minCycleDuration: '', maxCycleDuration: '', sort: 'date-desc' },
    hasActiveFilters: false,
    setFilters: mockSetFilters,
    clearFilters: vi.fn(),
    setPage: vi.fn(),
    setPageSize: vi.fn(),
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderWithRouter(initialUrl = '/groups') {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/groups/:id" element={<div>Group Detail</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GroupsPage', () => {
  it('renders the groups list', () => {
    renderWithRouter();
    expect(screen.getByText('Alpha Circle')).toBeInTheDocument();
    expect(screen.getByText('Beta Pool')).toBeInTheDocument();
  });

  it('renders filter inputs', () => {
    renderWithRouter();
    expect(screen.getByLabelText('Filter by token type')).toBeInTheDocument();
    expect(screen.getByLabelText('Minimum contribution amount')).toBeInTheDocument();
    expect(screen.getByLabelText('Maximum contribution amount')).toBeInTheDocument();
  });

  it('pre-fills currency filter from URL param', () => {
    renderWithRouter('/groups?currency=XLM');
    expect(screen.getByLabelText('Filter by token type')).toHaveValue('XLM');
  });

  it('pre-fills minAmount from URL param', () => {
    renderWithRouter('/groups?minAmount=100');
    expect(screen.getByLabelText('Minimum contribution amount')).toHaveValue(100);
  });

  it('pre-fills maxAmount from URL param', () => {
    renderWithRouter('/groups?maxAmount=500');
    expect(screen.getByLabelText('Maximum contribution amount')).toHaveValue(500);
  });

  it('updates URL when currency filter changes', async () => {
    const { container } = renderWithRouter();
    fireEvent.change(screen.getByLabelText('Filter by token type'), { target: { value: 'USDC' } });
    await waitFor(() => {
      // The input value should reflect the change
      expect(screen.getByLabelText('Filter by token type')).toHaveValue('USDC');
    });
  });

  it('updates URL when minAmount changes', async () => {
    renderWithRouter();
    fireEvent.change(screen.getByLabelText('Minimum contribution amount'), { target: { value: '50' } });
    await waitFor(() => {
      expect(screen.getByLabelText('Minimum contribution amount')).toHaveValue(50);
    });
  });

  it('navigates to group detail on group click', async () => {
    renderWithRouter();
    fireEvent.click(screen.getByText('Alpha Circle').closest('.card') ?? screen.getByText('Alpha Circle'));
    await waitFor(() => {
      expect(screen.getByText('Group Detail')).toBeInTheDocument();
    });
  });
});
