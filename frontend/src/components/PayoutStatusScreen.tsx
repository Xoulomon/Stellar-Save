import {
  Box,
  Stack,
  Typography,
  Chip,
  Divider,
  LinearProgress,
} from '@mui/material';
import { getExplorerTxUrl } from '../utils/explorerUrl';
import type { PayoutEntry, PayoutQueueData } from '../types/contribution';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PayoutStatusScreenProps {
  /** Full queue data for the group */
  data: PayoutQueueData;
  /** Human-readable group name */
  groupName?: string;
  /** Connected wallet address — used to highlight the current user's entry */
  currentUserAddress?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function pluralise(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

// ── Current-user summary card ─────────────────────────────────────────────────

function UserPositionCard({
  entry,
  totalMembers,
  cyclesCompleted,
  cycleDurationDays,
}: {
  entry: PayoutEntry;
  totalMembers: number;
  cyclesCompleted: number;
  cycleDurationDays?: number;
}) {
  const cyclesAway = entry.position - cyclesCompleted - 1;
  const daysAway =
    cycleDurationDays !== undefined && cyclesAway > 0
      ? cyclesAway * cycleDurationDays
      : undefined;

  const statusColor: Record<PayoutEntry['status'], 'success' | 'warning' | 'default'> = {
    completed: 'success',
    next: 'warning',
    upcoming: 'default',
  };

  return (
    <Box
      sx={{
        borderRadius: 3,
        border: '2px solid',
        borderColor: 'primary.200',
        bgcolor: 'primary.50',
        p: 2.5,
      }}
    >
      <Stack spacing={1.5}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle2" fontWeight={700} color="primary.main">
            Your Payout Position
          </Typography>
          <Chip
            label={entry.status === 'next' ? 'Up Next!' : entry.status === 'completed' ? 'Paid' : 'Upcoming'}
            color={statusColor[entry.status]}
            size="small"
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="h4" fontWeight={800} color="primary.main">
            #{entry.position}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            of {pluralise(totalMembers, 'member')}
          </Typography>
        </Box>

        <Divider />

        <Stack spacing={0.5}>
          <Row label="Payout amount" value={`${entry.amount} XLM`} bold />
          <Row
            label={entry.status === 'completed' ? 'Received on' : 'Estimated date'}
            value={formatDate(entry.status === 'completed' && entry.paidAt ? entry.paidAt : entry.estimatedDate)}
          />
          {daysAway !== undefined && entry.status === 'upcoming' && (
            <Row label="Est. wait" value={`~${pluralise(daysAway, 'day')}`} />
          )}
          {cyclesAway > 0 && entry.status === 'upcoming' && (
            <Row label="Cycles remaining" value={String(cyclesAway)} />
          )}
          {entry.txHash && (
            <Box sx={{ pt: 0.5 }}>
              <a
                href={getExplorerTxUrl(entry.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.8rem', color: '#6366f1', textDecoration: 'none' }}
              >
                View payout transaction →
              </a>
            </Box>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={bold ? 700 : 400} textAlign="right">{value}</Typography>
    </Box>
  );
}

// ── Queue progress bar ────────────────────────────────────────────────────────

function QueueProgress({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <Stack spacing={0.5}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          {completed} of {total} paid out
        </Typography>
        <Typography variant="caption" fontWeight={600}>{pct}%</Typography>
      </Box>
      <LinearProgress variant="determinate" value={pct} sx={{ borderRadius: 4, height: 6 }} />
    </Stack>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * PayoutStatusScreen — shows a member's position in the payout queue,
 * estimated date, group context, and a link to the explorer when paid.
 */
export function PayoutStatusScreen({
  data,
  groupName,
  currentUserAddress,
}: PayoutStatusScreenProps) {
  const address = currentUserAddress ?? data.currentUserAddress;
  const userEntry = address
    ? data.entries.find((e) => e.memberAddress === address)
    : undefined;

  const completed = data.entries.filter((e) => e.status === 'completed');
  const nextEntry = data.entries.find((e) => e.status === 'next');

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Box>
        {groupName && (
          <Typography variant="h6" fontWeight={700} gutterBottom>
            {groupName}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          Cycle #{data.cycleId} · Payout Queue
        </Typography>
      </Box>

      {/* Progress */}
      <QueueProgress completed={completed.length} total={data.totalMembers} />

      {/* Current user card */}
      {userEntry ? (
        <UserPositionCard
          entry={userEntry}
          totalMembers={data.totalMembers}
          cyclesCompleted={completed.length}
        />
      ) : (
        <Box
          sx={{ borderRadius: 2, bgcolor: 'action.hover', p: 2, textAlign: 'center' }}
        >
          <Typography variant="body2" color="text.secondary">
            Connect your wallet to see your payout position.
          </Typography>
        </Box>
      )}

      {/* Next payout highlight */}
      {nextEntry && nextEntry.memberAddress !== address && (
        <Box sx={{ borderRadius: 2, bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.200', p: 2 }}>
          <Typography variant="caption" fontWeight={700} color="warning.dark" textTransform="uppercase" letterSpacing={0.5}>
            Next Payout
          </Typography>
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            <Row label="Recipient" value={nextEntry.memberName ?? `${nextEntry.memberAddress.slice(0, 6)}…${nextEntry.memberAddress.slice(-4)}`} />
            <Row label="Amount" value={`${nextEntry.amount} XLM`} bold />
            <Row label="Estimated date" value={formatDate(nextEntry.estimatedDate)} />
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

export default PayoutStatusScreen;
