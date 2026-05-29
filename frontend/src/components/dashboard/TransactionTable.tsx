import React from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip } from '@mui/material';
import { Skeleton } from '../Skeleton/Skeleton';
import type { Transaction } from '../../types/dashboard';

interface Props { transactions: Transaction[]; isLoading?: boolean; }

const TYPE_SIGN: Record<string, string> = { payout: '+', deposit: '-', withdrawal: '-', fee: '-' };
const TYPE_COLOR: Record<string, string> = { payout: 'success.main', deposit: 'text.primary', withdrawal: 'error.main', fee: 'text.secondary' };

export const TransactionTable: React.FC<Props> = ({ transactions, isLoading }) => (
  <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
    <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography variant="h6" fontWeight="bold">Recent Transactions</Typography>
    </Box>
    <TableContainer>
      <Table sx={{ minWidth: 480 }}>
        <TableHead sx={{ bgcolor: 'action.hover' }}>
          <TableRow>
            {['DATE', 'TYPE', 'AMOUNT', 'STATUS'].map((h) => (
              <TableCell key={h} sx={{ fontWeight: 'bold', color: 'text.secondary', fontSize: '0.72rem' }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading
            ? [1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i}>
                  {[100, 80, 90, 60].map((w, j) => (
                    <TableCell key={j}><Skeleton variant="text" width={w} height={14} /></TableCell>
                  ))}
                </TableRow>
              ))
            : transactions.map((tx) => (
                <TableRow key={tx.id} hover>
                  <TableCell><Typography variant="body2">{tx.date}</Typography></TableCell>
                  <TableCell><Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{tx.type}</Typography></TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold" color={TYPE_COLOR[tx.type] ?? 'text.primary'}>
                      {TYPE_SIGN[tx.type] ?? ''}{tx.amount.toLocaleString()} {tx.currency}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={tx.status.toUpperCase()} size="small" color={tx.status === 'paid' ? 'success' : 'warning'} variant="soft" sx={{ fontWeight: 'bold', fontSize: '0.65rem' }} />
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </TableContainer>
  </Paper>
);
