/**
 * dashboard/TransactionTable — migrated to DataTable
 *
 * Replaces the inline MUI Table with the generic DataTable component
 * for consistent sorting, pagination, and loading states.
 */
import React from 'react';
import { Box, Chip, Typography } from '@mui/material';

import { DataTable } from '../DataTable/DataTable';
import type { DataTableColumn } from '../DataTable/DataTable';
import type { Transaction } from '../../types/dashboard';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_SIGN: Record<string, string> = {
  payout: '+',
  deposit: '-',
  withdrawal: '-',
  fee: '-',
};

const TYPE_COLOR: Record<string, string> = {
  payout: 'success.main',
  deposit: 'text.primary',
  withdrawal: 'error.main',
  fee: 'text.secondary',
};

// ── Column definitions ────────────────────────────────────────────────────────

const columns: DataTableColumn<Transaction>[] = [
  {
    key: 'date',
    header: 'Date',
    sortable: true,
    render: (row) => <Typography variant="body2">{row.date}</Typography>,
  },
  {
    key: 'type',
    header: 'Type',
    sortable: true,
    render: (row) => (
      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
        {row.type}
      </Typography>
    ),
  },
  {
    key: 'amount',
    header: 'Amount',
    sortable: true,
    sortComparator: (a, b) => a.amount - b.amount,
    render: (row) => (
      <Typography
        variant="body2"
        fontWeight="bold"
        color={TYPE_COLOR[row.type] ?? 'text.primary'}
      >
        {TYPE_SIGN[row.type] ?? ''}
        {row.amount.toLocaleString()} {row.currency}
      </Typography>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (row) => (
      <Chip
        label={row.status.toUpperCase()}
        size="small"
        color={row.status === 'paid' ? 'success' : 'warning'}
        variant="outlined"
        sx={{ fontWeight: 'bold', fontSize: '0.65rem' }}
      />
    ),
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  transactions: Transaction[];
  isLoading?: boolean;
}

export const TransactionTable: React.FC<Props> = ({ transactions, isLoading }) => (
  <Box
    sx={{
      borderRadius: 3,
      border: '1px solid',
      borderColor: 'divider',
      overflow: 'hidden',
      bgcolor: 'background.paper',
    }}
  >
    <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography variant="h6" fontWeight="bold">
        Recent Transactions
      </Typography>
    </Box>
    <Box sx={{ p: 2 }}>
      <DataTable
        columns={columns}
        rows={transactions}
        loading={isLoading}
        emptyMessage="No recent transactions"
        defaultSortKey="date"
        defaultSortDir="desc"
        pageSize={5}
        pageSizeOptions={[5, 10]}
        caption="Recent transactions"
      />
    </Box>
  </Box>
);
