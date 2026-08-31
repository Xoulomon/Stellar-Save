import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from '../components/DataTable/DataTable';
import type { DataTableColumn } from '../components/DataTable/DataTable';

// ── Sample data ───────────────────────────────────────────────────────────────

interface Row {
  id: string;
  name: string;
  amount: number;
  date: string;
  status: string;
}

const sampleRows: Row[] = [
  { id: '1', name: 'Alice', amount: 300, date: '2026-01-10', status: 'success' },
  { id: '2', name: 'Bob',   amount: 150, date: '2026-01-15', status: 'pending' },
  { id: '3', name: 'Carol', amount: 450, date: '2026-01-05', status: 'success' },
  { id: '4', name: 'Dave',  amount:  75, date: '2026-01-20', status: 'failed'  },
  { id: '5', name: 'Eve',   amount: 200, date: '2026-01-12', status: 'success' },
];

const columns: DataTableColumn<Row>[] = [
  { key: 'name',   header: 'Name',   sortable: true },
  { key: 'amount', header: 'Amount', sortable: true },
  { key: 'date',   header: 'Date',   sortable: true },
  { key: 'status', header: 'Status', sortable: false },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderTable(
  rows = sampleRows,
  overrides: Partial<Parameters<typeof DataTable<Row>>[0]> = {},
) {
  return render(<DataTable columns={columns} rows={rows} {...overrides} />);
}

// ── Rendering tests ───────────────────────────────────────────────────────────

describe('DataTable — rendering', () => {
  it('renders all column headers', () => {
    renderTable();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders all row data', () => {
    renderTable();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
    expect(screen.getByText('Dave')).toBeInTheDocument();
    expect(screen.getByText('Eve')).toBeInTheDocument();
  });

  it('renders empty state when no rows', () => {
    renderTable([]);
    expect(screen.getByText('No data found')).toBeInTheDocument();
  });

  it('renders custom empty message', () => {
    renderTable([], { emptyMessage: 'Nothing here yet' });
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
  });

  it('renders loading skeletons instead of rows when loading=true', () => {
    renderTable(sampleRows, { loading: true });
    // Row data should NOT appear
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    // Skeletons should appear
    const skeletonCells = document.querySelectorAll('.data-table__skeleton-cell');
    expect(skeletonCells.length).toBeGreaterThan(0);
  });

  it('sets aria-busy on table when loading', () => {
    renderTable([], { loading: true });
    const table = document.querySelector('table');
    expect(table).toHaveAttribute('aria-busy', 'true');
  });

  it('renders a caption when provided', () => {
    renderTable(sampleRows, { caption: 'Transaction list' });
    expect(screen.getByText('Transaction list')).toBeInTheDocument();
  });

  it('applies custom render function for a column', () => {
    const cols: DataTableColumn<Row>[] = [
      { key: 'name', header: 'Name', render: (row) => <strong data-testid="custom">{row.name}!</strong> },
    ];
    render(<DataTable columns={cols} rows={sampleRows} />);
    const customCells = screen.getAllByTestId('custom');
    expect(customCells).toHaveLength(sampleRows.length);
    expect(customCells[0]).toHaveTextContent('Alice!');
  });

  it('sets aria-sort="none" on sortable non-active columns', () => {
    renderTable();
    const nameTh = screen.getByRole('columnheader', { name: /name/i });
    expect(nameTh).toHaveAttribute('aria-sort', 'none');
  });
});

// ── Sorting tests ─────────────────────────────────────────────────────────────

describe('DataTable — sorting', () => {
  it('sorts rows ascending by name on first click', async () => {
    const user = userEvent.setup();
    renderTable();

    const nameTh = screen.getByRole('columnheader', { name: /name/i });
    await user.click(nameTh);

    const rows = screen.getAllByRole('row').slice(1); // skip header
    expect(rows[0]).toHaveTextContent('Alice');
    expect(rows[1]).toHaveTextContent('Bob');
    expect(rows[2]).toHaveTextContent('Carol');
  });

  it('sorts rows descending by name on second click', async () => {
    const user = userEvent.setup();
    renderTable();

    const nameTh = screen.getByRole('columnheader', { name: /name/i });
    await user.click(nameTh);
    await user.click(nameTh);

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Eve');
    expect(rows[1]).toHaveTextContent('Dave');
  });

  it('sorts by amount ascending', async () => {
    const user = userEvent.setup();
    renderTable();

    const amountTh = screen.getByRole('columnheader', { name: /amount/i });
    await user.click(amountTh);

    const rows = screen.getAllByRole('row').slice(1);
    // Dave 75, Bob 150, Eve 200, Alice 300, Carol 450
    expect(rows[0]).toHaveTextContent('75');
    expect(rows[4]).toHaveTextContent('450');
  });

  it('sorts by amount descending on second click', async () => {
    const user = userEvent.setup();
    renderTable();

    const amountTh = screen.getByRole('columnheader', { name: /amount/i });
    await user.click(amountTh);
    await user.click(amountTh);

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('450');
    expect(rows[4]).toHaveTextContent('75');
  });

  it('sorts by date', async () => {
    const user = userEvent.setup();
    renderTable();

    const dateTh = screen.getByRole('columnheader', { name: /date/i });
    await user.click(dateTh);

    const rows = screen.getAllByRole('row').slice(1);
    // Carol 2026-01-05, Alice 2026-01-10, Eve 2026-01-12, Bob 2026-01-15, Dave 2026-01-20
    expect(rows[0]).toHaveTextContent('Carol');
    expect(rows[4]).toHaveTextContent('Dave');
  });

  it('sets aria-sort="ascending" on sorted column header', async () => {
    const user = userEvent.setup();
    renderTable();

    const nameTh = screen.getByRole('columnheader', { name: /name/i });
    await user.click(nameTh);

    expect(nameTh).toHaveAttribute('aria-sort', 'ascending');
  });

  it('sets aria-sort="descending" after second click', async () => {
    const user = userEvent.setup();
    renderTable();

    const nameTh = screen.getByRole('columnheader', { name: /name/i });
    await user.click(nameTh);
    await user.click(nameTh);

    expect(nameTh).toHaveAttribute('aria-sort', 'descending');
  });

  it('does NOT add aria-sort to non-sortable column', () => {
    renderTable();
    const statusTh = screen.getByRole('columnheader', { name: /status/i });
    expect(statusTh).not.toHaveAttribute('aria-sort');
  });

  it('does not sort on click of non-sortable column', async () => {
    const user = userEvent.setup();
    renderTable();

    const statusTh = screen.getByRole('columnheader', { name: /status/i });
    await user.click(statusTh);

    // Row order should remain original (Alice first)
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Alice');
  });

  it('applies defaultSortKey ascending', () => {
    renderTable(sampleRows, { defaultSortKey: 'amount', defaultSortDir: 'asc' });
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('75');
  });

  it('applies defaultSortKey descending', () => {
    renderTable(sampleRows, { defaultSortKey: 'amount', defaultSortDir: 'desc' });
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('450');
  });

  it('supports keyboard Enter to sort', async () => {
    const user = userEvent.setup();
    renderTable();

    const nameTh = screen.getByRole('columnheader', { name: /name/i });
    nameTh.focus();
    await user.keyboard('{Enter}');

    expect(nameTh).toHaveAttribute('aria-sort', 'ascending');
  });

  it('supports keyboard Space to sort', async () => {
    const user = userEvent.setup();
    renderTable();

    const nameTh = screen.getByRole('columnheader', { name: /name/i });
    nameTh.focus();
    await user.keyboard(' ');

    expect(nameTh).toHaveAttribute('aria-sort', 'ascending');
  });

  it('uses a custom sort comparator when provided', async () => {
    const user = userEvent.setup();
    // Sort by length of name (shortest first)
    const customCols: DataTableColumn<Row>[] = [
      {
        key: 'name',
        header: 'Name',
        sortable: true,
        sortComparator: (a, b) => a.name.length - b.name.length,
      },
      { key: 'amount', header: 'Amount' },
    ];
    render(<DataTable columns={customCols} rows={sampleRows} />);

    const nameTh = screen.getByRole('columnheader', { name: /name/i });
    await user.click(nameTh);

    const rows = screen.getAllByRole('row').slice(1);
    // Bob(3), Eve(3), Alice(5), Carol(5), Dave(4) → but stable order within same length varies
    // shortest: Bob or Eve (len=3), longest: Alice/Carol (len=5)
    expect(rows[0].textContent).toMatch(/Bob|Eve/);
    expect(rows[rows.length - 1].textContent).toMatch(/Alice|Carol/);
  });

  it('resets to page 1 when sort changes', async () => {
    const user = userEvent.setup();
    // 12 rows, page size 5 → 3 pages
    const manyRows = Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      name: `User${i}`,
      amount: i * 10,
      date: '2026-01-01',
      status: 'success',
    }));

    renderTable(manyRows, { pageSize: 5 });

    // Navigate to page 2
    const nextBtn = screen.getByRole('button', { name: /next page/i });
    await user.click(nextBtn);
    expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();

    // Sort
    const nameTh = screen.getByRole('columnheader', { name: /name/i });
    await user.click(nameTh);

    // Should be back on page 1
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
  });
});

// ── Pagination tests ──────────────────────────────────────────────────────────

describe('DataTable — pagination', () => {
  const manyRows = Array.from({ length: 12 }, (_, i) => ({
    id: String(i + 1),
    name: `User${String(i + 1).padStart(2, '0')}`,
    amount: (i + 1) * 10,
    date: '2026-01-01',
    status: 'success',
  }));

  it('shows only pageSize rows per page', () => {
    renderTable(manyRows, { pageSize: 5 });
    const dataRows = screen.getAllByRole('row').slice(1);
    expect(dataRows).toHaveLength(5);
  });

  it('shows pagination controls when there are multiple pages', () => {
    renderTable(manyRows, { pageSize: 5 });
    expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
  });

  it('does NOT show pagination when pageSize=0', () => {
    renderTable(manyRows, { pageSize: 0 });
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
  });

  it('navigates to next page', async () => {
    const user = userEvent.setup();
    renderTable(manyRows, { pageSize: 5 });

    const nextBtn = screen.getByRole('button', { name: /next page/i });
    await user.click(nextBtn);

    expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();
    const dataRows = screen.getAllByRole('row').slice(1);
    expect(dataRows[0]).toHaveTextContent('User06');
  });

  it('navigates to previous page', async () => {
    const user = userEvent.setup();
    renderTable(manyRows, { pageSize: 5 });

    const nextBtn = screen.getByRole('button', { name: /next page/i });
    await user.click(nextBtn);
    const prevBtn = screen.getByRole('button', { name: /previous page/i });
    await user.click(prevBtn);

    expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    expect(screen.getByText('User01')).toBeInTheDocument();
  });

  it('navigates to last page', async () => {
    const user = userEvent.setup();
    renderTable(manyRows, { pageSize: 5 });

    const lastBtn = screen.getByRole('button', { name: /last page/i });
    await user.click(lastBtn);

    expect(screen.getByText(/Page 3 of 3/)).toBeInTheDocument();
  });

  it('navigates to first page', async () => {
    const user = userEvent.setup();
    renderTable(manyRows, { pageSize: 5 });

    const lastBtn = screen.getByRole('button', { name: /last page/i });
    await user.click(lastBtn);
    const firstBtn = screen.getByRole('button', { name: /first page/i });
    await user.click(firstBtn);

    expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
  });

  it('disables previous/first buttons on first page', () => {
    renderTable(manyRows, { pageSize: 5 });
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /first page/i })).toBeDisabled();
  });

  it('disables next/last buttons on last page', async () => {
    const user = userEvent.setup();
    renderTable(manyRows, { pageSize: 5 });

    const lastBtn = screen.getByRole('button', { name: /last page/i });
    await user.click(lastBtn);

    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /last page/i })).toBeDisabled();
  });

  it('shows row range info', () => {
    renderTable(manyRows, { pageSize: 5 });
    expect(screen.getByText(/Showing 1–5 of 12/)).toBeInTheDocument();
  });

  it('shows correct row range on page 2', async () => {
    const user = userEvent.setup();
    renderTable(manyRows, { pageSize: 5 });

    await user.click(screen.getByRole('button', { name: /next page/i }));
    expect(screen.getByText(/Showing 6–10 of 12/)).toBeInTheDocument();
  });

  it('shows correct row range on last page', async () => {
    const user = userEvent.setup();
    renderTable(manyRows, { pageSize: 5 });

    await user.click(screen.getByRole('button', { name: /last page/i }));
    expect(screen.getByText(/Showing 11–12 of 12/)).toBeInTheDocument();
  });

  it('changes page size via selector', async () => {
    const user = userEvent.setup();
    renderTable(manyRows, { pageSize: 5, pageSizeOptions: [5, 10, 25] });

    const select = screen.getByRole('combobox', { name: /per page/i });
    await user.selectOptions(select, '10');

    const dataRows = screen.getAllByRole('row').slice(1);
    expect(dataRows).toHaveLength(10);
  });

  it('resets to page 1 when page size changes', async () => {
    const user = userEvent.setup();
    renderTable(manyRows, { pageSize: 5, pageSizeOptions: [5, 10, 25] });

    // Go to page 2
    await user.click(screen.getByRole('button', { name: /next page/i }));
    expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();

    // Change page size
    const select = screen.getByRole('combobox', { name: /per page/i });
    await user.selectOptions(select, '10');

    expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
  });
});

// ── Row interaction tests ─────────────────────────────────────────────────────

describe('DataTable — row interactions', () => {
  it('calls onRowClick when a row is clicked', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    renderTable(sampleRows, { onRowClick: handler });

    const rows = screen.getAllByRole('button');
    await user.click(rows[0]);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  it('calls onRowClick on Enter key', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    renderTable(sampleRows, { onRowClick: handler });

    const rows = screen.getAllByRole('button');
    rows[0].focus();
    await user.keyboard('{Enter}');

    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not add role=button when no onRowClick', () => {
    renderTable(sampleRows);
    expect(screen.queryAllByRole('button').filter((el) => el.tagName === 'TR')).toHaveLength(0);
  });
});

// ── rowKey prop tests ─────────────────────────────────────────────────────────

describe('DataTable — rowKey', () => {
  it('uses custom rowKey function', () => {
    // No assertion on DOM, just ensuring no "duplicate key" error and rows render
    renderTable(sampleRows, { rowKey: (row) => row.name });
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(sampleRows.length);
  });
});
