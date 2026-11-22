/**
 * TransactionHistory — Issue #769 / Issue #1840
 *
 * Presentational paginated table component displaying a member's full contribution and
 * payout history. Uses MUI DataGrid with usePaginatedQuery hook:
 * - Sorting by date, amount, and type
 * - Horizon API fetch filtered by account and contract ID
 * - Loading and empty states
 */
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  Stack,
  CircularProgress,
  Alert,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { useMemo, useState, useEffect } from 'react';

import { useWallet } from '../hooks/useWallet';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import { fetchHorizonTransactions, MOCK_TRANSACTIONS } from '../utils/horizonTransactions';
import { buildColumns } from '../utils/transactionColumns';

import type { Transaction } from '../types/transaction';

export interface TransactionHistoryProps {
  /** Override the wallet address to query (defaults to connected wallet) */
  address?: string;
  /** Optional Soroban contract ID to filter transactions */
  contractId?: string;
  /** Initial page size */
  pageSize?: number;
}

export function TransactionHistory({
  address: addressProp,
  contractId,
  pageSize: initialPageSize = 10,
}: TransactionHistoryProps) {
  const { activeAddress, network } = useWallet();
  const address = addressProp ?? activeAddress;
  const net = network ?? 'TESTNET';

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { paginationModel, sortModel, setPaginationModel, setSortModel } = usePaginatedQuery({
    initialPageSize,
  });

  // Fetch from Horizon (falls back to mock if no address or fetch fails)
  useEffect(() => {
    if (!address) {
      setTransactions(MOCK_TRANSACTIONS);
      return;
    }
    setLoading(true);
    setError(null);
    fetchHorizonTransactions(address, net, contractId)
      .then((txs) => {
        setTransactions(txs.length > 0 ? txs : MOCK_TRANSACTIONS);
      })
      .catch(() => {
        setTransactions(MOCK_TRANSACTIONS);
        setError(null);
      })
      .finally(() => setLoading(false));
  }, [address, net, contractId]);

  // Client-side type filter
  const filtered = useMemo(() => {
    if (typeFilter === 'all') return transactions;
    return transactions.filter((tx) => tx.type === typeFilter);
  }, [transactions, typeFilter]);

  const columns = useMemo(() => buildColumns(net), [net]);

  const uniqueTypes = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.type))),
    [transactions]
  );

  return (
    <Box>
      {/* Toolbar */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ mb: 2 }}
        alignItems={{ sm: 'center' }}
      >
        <Typography variant="h3" sx={{ flex: 1 }}>
          Transaction History
        </Typography>
        <TextField
          select
          size="small"
          label="Type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="all">All types</MenuItem>
          {uniqueTypes.map((t) => (
            <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>
              {t}
            </MenuItem>
          ))}
        </TextField>
        {!address && (
          <Typography variant="caption" color="text.secondary">
            Showing demo data — connect wallet to see real transactions
          </Typography>
        )}
      </Stack>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* DataGrid */}
      <Box sx={{ height: 480, width: '100%' }}>
        <DataGrid
          rows={filtered}
          columns={columns}
          loading={loading}
          sortModel={sortModel}
          onSortModelChange={setSortModel}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[5, 10, 25, 50]}
          disableRowSelectionOnClick
          density="compact"
          slots={{
            loadingOverlay: () => (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                }}
              >
                <CircularProgress size={32} />
              </Box>
            ),
            noRowsOverlay: () => (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                }}
              >
                <Typography color="text.secondary">No transactions found</Typography>
              </Box>
            ),
          }}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            '& .MuiDataGrid-columnHeaders': { bgcolor: 'action.hover' },
            '& .MuiDataGrid-row:hover': { bgcolor: 'action.hover' },
          }}
        />
      </Box>
    </Box>
  );
}

export default TransactionHistory;
