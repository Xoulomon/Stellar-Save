import { Chip, Typography, Link } from '@mui/material';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import type { Transaction } from '../types/transaction';

export const TYPE_COLORS: Record<string, 'success' | 'primary' | 'warning' | 'error' | 'default'> = {
  deposit: 'success',
  payment: 'primary',
  withdraw: 'warning',
  swap: 'default',
  claimable: 'success',
  other: 'default',
};

export function buildColumns(network: string): GridColDef[] {
  const explorerBase =
    network === 'MAINNET'
      ? 'https://stellar.expert/explorer/public/tx'
      : 'https://stellar.expert/explorer/testnet/tx';

  return [
    {
      field: 'createdAt',
      headerName: 'Date',
      width: 160,
      valueFormatter: (value: string) =>
        new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
      sortable: true,
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 130,
      sortable: true,
      renderCell: (params: GridRenderCellParams<Transaction, string>) => (
        <Chip
          label={params.value ?? ''}
          size="small"
          color={TYPE_COLORS[params.value ?? ''] ?? 'default'}
          sx={{ textTransform: 'capitalize', fontWeight: 600 }}
        />
      ),
    },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 140,
      sortable: true,
      sortComparator: (a: string, b: string) => parseFloat(a) - parseFloat(b),
      renderCell: (params: GridRenderCellParams<Transaction, string>) => {
        const val = parseFloat(params.value ?? '0');
        return (
          <Typography
            variant="body2"
            fontWeight={600}
            color={val >= 0 ? 'success.main' : 'error.main'}
          >
            {params.value} {params.row.assetCode}
          </Typography>
        );
      },
    },
    {
      field: 'assetCode',
      headerName: 'Asset',
      width: 90,
      sortable: true,
    },
    {
      field: 'from',
      headerName: 'From',
      width: 140,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Transaction, string>) => (
        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'memo',
      headerName: 'Memo',
      flex: 1,
      minWidth: 160,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Transaction, string>) => (
        <Typography variant="caption" color="text.secondary" noWrap>
          {params.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      sortable: true,
      renderCell: (params: GridRenderCellParams<Transaction, string>) => (
        <Chip
          label={params.value}
          size="small"
          color={
            params.value === 'success'
              ? 'success'
              : params.value === 'pending'
                ? 'warning'
                : 'error'
          }
        />
      ),
    },
    {
      field: 'hash',
      headerName: 'TX',
      width: 80,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Transaction, string>) => (
        <Link
          href={`${explorerBase}/${params.value}`}
          target="_blank"
          rel="noopener noreferrer"
          variant="caption"
          onClick={(e) => e.stopPropagation()}
        >
          View ↗
        </Link>
      ),
    },
  ];
}
