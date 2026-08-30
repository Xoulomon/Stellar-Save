/**
 * TransactionTables — migrated to DataTable
 *
 * Re-implements the earlier raw HTML table using the generic DataTable
 * component, gaining free sorting and pagination.
 */
import React from 'react';

import type { Transaction } from '../types/transaction';
import { Badge } from './Badge';
import { Button } from './Button';
import { DataTable } from './DataTable/DataTable';
import type { DataTableColumn } from './DataTable/DataTable';

interface Props {
  transactions: Transaction[];
  isLoading: boolean;
  onRowClick: (tx: Transaction) => void;
}

const columns: DataTableColumn<Transaction>[] = [
  {
    key: 'createdAt',
    header: 'Date',
    sortable: true,
    render: (row) => new Date(row.createdAt).toLocaleDateString(),
  },
  {
    key: 'type',
    header: 'Type',
    sortable: true,
    cellClassName: 'tx-table__type',
    render: (row) => (
      <span style={{ textTransform: 'capitalize' }}>{row.type}</span>
    ),
  },
  {
    key: 'amount',
    header: 'Amount',
    sortable: true,
    sortComparator: (a, b) => parseFloat(a.amount) - parseFloat(b.amount),
    render: (row) => (
      <span
        className={
          parseFloat(row.amount) > 0 ? 'tx-table__amount--positive' : 'tx-table__amount--negative'
        }
      >
        {row.amount} {row.assetCode}
      </span>
    ),
  },
  {
    key: 'assetCode',
    header: 'Asset',
    sortable: true,
  },
  {
    key: 'from',
    header: 'From / To',
    sortable: false,
    render: (row) => (
      <span className="tx-table__address">{row.from}</span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (row) => (
      <Badge variant={row.status === 'success' ? 'success' : 'danger'}>
        {row.status}
      </Badge>
    ),
  },
  {
    key: '_actions',
    header: '',
    sortable: false,
    render: () => (
      <Button variant="secondary" size="sm">
        Details
      </Button>
    ),
  },
];

const TransactionTable: React.FC<Props> = ({ transactions, isLoading, onRowClick }) => (
  <>
    <style>{`
      .tx-table__type { text-transform: capitalize; }
      .tx-table__amount--positive { color: #4ade80; font-weight: 600; }
      .tx-table__amount--negative { color: #f87171; font-weight: 600; }
      .tx-table__address { font-size: 0.8125rem; color: rgba(0,0,0,0.54); overflow: hidden; text-overflow: ellipsis; max-width: 180px; white-space: nowrap; }
    `}</style>
    <DataTable
      columns={columns}
      rows={transactions}
      loading={isLoading}
      emptyMessage="No transactions found"
      defaultSortKey="createdAt"
      defaultSortDir="desc"
      pageSize={10}
      onRowClick={onRowClick}
      caption="Transaction history"
    />
  </>
);

export default TransactionTable;
