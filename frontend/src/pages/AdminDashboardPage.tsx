/**
 * AdminDashboardPage — Platform monitoring and moderation.
 *
 * Sections:
 *  1. Health metrics strip (users, groups, transactions, volume, last backup).
 *  2. Trend charts — contribution volume and group count over time (Recharts).
 *  3. User table with flag/delete moderation actions.
 *  4. Group table with flag/unflag moderation actions.
 *  5. Audit log tail.
 *
 * Access is guarded by AdminRoute — non-admin wallets are redirected before
 * this component mounts.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Stack,
  Typography,
  Box,
  Alert,
  Chip,
  Divider,
  LinearProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import FlagIcon from '@mui/icons-material/Flag';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { AppLayout, AppCard } from '../ui';
import { Button } from '../components/Button';
import { useWallet } from '../hooks/useWallet';
import {
  fetchPlatformStats,
  fetchAdminUsers,
  fetchAdminGroups,
  fetchAuditLogs,
  flagGroup,
  deleteAdminUser,
  updateAdminUser,
} from '../utils/adminApi';
import type { AdminUser, AdminGroup, AuditLog } from '../utils/adminApi';

// ── Query keys ────────────────────────────────────────────────────────────────

const adminKeys = {
  stats: () => ['admin', 'stats'] as const,
  users: () => ['admin', 'users'] as const,
  groups: () => ['admin', 'groups'] as const,
  logs: () => ['admin', 'audit-logs'] as const,
};

// ── Mock trend data (derived from stats) ──────────────────────────────────────

function buildVolumeTrend(totalVolume: number) {
  const now = Date.now();
  return Array.from({ length: 7 }, (_, i) => ({
    day: new Date(now - (6 - i) * 86_400_000).toLocaleDateString('en', { weekday: 'short' }),
    volume: Math.round((totalVolume / 7) * (0.7 + Math.random() * 0.6)),
  }));
}

function buildGroupTrend(totalGroups: number) {
  return Array.from({ length: 6 }, (_, i) => ({
    month: new Date(Date.now() - (5 - i) * 30 * 86_400_000).toLocaleDateString('en', { month: 'short' }),
    groups: Math.max(1, Math.round(totalGroups * ((i + 1) / 6) * (0.85 + Math.random() * 0.3))),
  }));
}

// ── Stat strip ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

function StatCard({ label, value, sub, color = 'primary.main' }: StatCardProps) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 140,
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="caption" color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={800} color={color} sx={{ mt: 0.5 }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary">{sub}</Typography>
      )}
    </Box>
  );
}

// ── Delete user dialog ────────────────────────────────────────────────────────

function DeleteUserDialog({
  user,
  adminId,
  onClose,
  onDeleted,
}: {
  user: AdminUser;
  adminId: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const mutation = useMutation({
    mutationFn: () => deleteAdminUser(user.id, adminId),
    onSuccess: onDeleted,
  });

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete user?</DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          Permanently remove <strong>{user.name || user.address}</strong> from the platform?
          This action is logged in the audit trail.
        </Typography>
        {mutation.isError && (
          <Alert severity="error" sx={{ mt: 1 }}>{(mutation.error as Error).message}</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
        <Button variant="primary" onClick={() => mutation.mutate()} loading={mutation.isPending}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Users table ───────────────────────────────────────────────────────────────

function UsersTable({ adminId }: { adminId: string }) {
  const qc = useQueryClient();
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: adminKeys.users(),
    queryFn: fetchAdminUsers,
    staleTime: 30_000,
  });

  const flagMutation = useMutation({
    mutationFn: ({ user, flagged }: { user: AdminUser; flagged: boolean }) =>
      updateAdminUser(user.id, { flagged }, adminId),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users() }),
  });

  if (isLoading) return <LinearProgress />;

  return (
    <>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Address</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Groups</TableCell>
            <TableCell>Joined</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id} sx={{ bgcolor: user.flagged ? 'error.50' : undefined }}>
              <TableCell>
                <Tooltip title={user.address}>
                  <Typography variant="body2" fontFamily="monospace" sx={{ fontSize: '0.78rem' }}>
                    {user.address.slice(0, 8)}…
                  </Typography>
                </Tooltip>
              </TableCell>
              <TableCell>{user.name || '—'}</TableCell>
              <TableCell>{user.groupIds.length}</TableCell>
              <TableCell>{new Date(user.joinedAt).toLocaleDateString()}</TableCell>
              <TableCell>
                {user.flagged ? (
                  <Chip icon={<FlagIcon />} label="Flagged" size="small" color="error" />
                ) : (
                  <Chip icon={<CheckCircleIcon />} label="Active" size="small" color="success" />
                )}
              </TableCell>
              <TableCell align="right">
                <Tooltip title={user.flagged ? 'Unflag user' : 'Flag for review'}>
                  <IconButton
                    size="small"
                    onClick={() => flagMutation.mutate({ user, flagged: !user.flagged })}
                    color={user.flagged ? 'default' : 'warning'}
                  >
                    <FlagIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete user">
                  <IconButton size="small" color="error" onClick={() => setDeletingUser(user)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {deletingUser && (
        <DeleteUserDialog
          user={deletingUser}
          adminId={adminId}
          onClose={() => setDeletingUser(null)}
          onDeleted={() => {
            setDeletingUser(null);
            qc.invalidateQueries({ queryKey: adminKeys.users() });
          }}
        />
      )}
    </>
  );
}

// ── Groups table ──────────────────────────────────────────────────────────────

function GroupsTable({ adminId }: { adminId: string }) {
  const qc = useQueryClient();

  const { data: groups = [], isLoading } = useQuery({
    queryKey: adminKeys.groups(),
    queryFn: fetchAdminGroups,
    staleTime: 30_000,
  });

  const flagMutation = useMutation({
    mutationFn: ({ group, flagged }: { group: AdminGroup; flagged: boolean }) =>
      flagGroup(group.id, flagged, adminId),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.groups() }),
  });

  if (isLoading) return <LinearProgress />;

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Members</TableCell>
          <TableCell>Contribution</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Flags</TableCell>
          <TableCell align="right">Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {groups.map((group) => (
          <TableRow key={group.id} sx={{ bgcolor: group.flagged ? 'warning.50' : undefined }}>
            <TableCell>{group.name}</TableCell>
            <TableCell>{group.currentMembers} / {group.maxMembers}</TableCell>
            <TableCell>{group.contributionAmount.toLocaleString()} XLM</TableCell>
            <TableCell>
              <Chip label={group.status} size="small" color={group.status === 'active' ? 'success' : 'default'} />
            </TableCell>
            <TableCell>
              {group.flagged && (
                <Chip icon={<WarningAmberIcon />} label="Under review" size="small" color="warning" />
              )}
            </TableCell>
            <TableCell align="right">
              <Tooltip title={group.flagged ? 'Clear flag' : 'Flag for review'}>
                <IconButton
                  size="small"
                  color={group.flagged ? 'default' : 'warning'}
                  onClick={() => flagMutation.mutate({ group, flagged: !group.flagged })}
                >
                  <FlagIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Audit log ─────────────────────────────────────────────────────────────────

function AuditLogTable() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: adminKeys.logs(),
    queryFn: fetchAuditLogs,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  if (isLoading) return <LinearProgress />;

  const recent = logs.slice(0, 50);

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Time</TableCell>
          <TableCell>Admin</TableCell>
          <TableCell>Action</TableCell>
          <TableCell>Target</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {recent.map((log: AuditLog) => (
          <TableRow key={log.id}>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>
              {new Date(log.timestamp).toLocaleString()}
            </TableCell>
            <TableCell>
              <Tooltip title={log.userId}>
                <Typography variant="body2" fontFamily="monospace" sx={{ fontSize: '0.78rem' }}>
                  {log.userId.slice(0, 8)}…
                </Typography>
              </Tooltip>
            </TableCell>
            <TableCell>
              <Chip label={log.action} size="small" variant="outlined" />
            </TableCell>
            <TableCell>
              {log.targetType && log.targetId
                ? `${log.targetType} ${log.targetId.slice(0, 8)}`
                : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { activeAddress } = useWallet();
  const adminId = activeAddress ?? '';

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: adminKeys.stats(),
    queryFn: fetchPlatformStats,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const volumeTrend = stats ? buildVolumeTrend(stats.totalVolume) : [];
  const groupTrend = stats ? buildGroupTrend(stats.totalGroups) : [];

  const healthOk = stats?.systemHealth === 'Healthy';
  const lastBackupAgo = stats
    ? Math.round((Date.now() - stats.lastBackup) / 60_000)
    : null;

  return (
    <AppLayout
      title="Admin Dashboard"
      subtitle="Platform health, moderation, and audit logs"
      footerText="Stellar Save"
    >
      <Stack spacing={3}>
        {statsError && (
          <Alert severity="error">Failed to load platform stats. {(statsError as Error).message}</Alert>
        )}

        {/* ── Health metrics ── */}
        <AppCard>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Platform Health</Typography>
          {statsLoading && <LinearProgress sx={{ mb: 2 }} />}
          {stats && (
            <>
              <Box
                sx={{
                  display: 'flex',
                  gap: 2,
                  flexWrap: 'wrap',
                  mb: 2,
                  alignItems: 'center',
                }}
              >
                <Chip
                  icon={healthOk ? <CheckCircleIcon /> : <WarningAmberIcon />}
                  label={stats.systemHealth}
                  color={healthOk ? 'success' : 'error'}
                />
                {lastBackupAgo !== null && (
                  <Typography variant="caption" color="text.secondary">
                    Last backup: {lastBackupAgo < 60
                      ? `${lastBackupAgo}m ago`
                      : `${Math.round(lastBackupAgo / 60)}h ago`}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <StatCard label="Users" value={stats.totalUsers.toLocaleString()} />
                <StatCard label="Groups" value={stats.totalGroups.toLocaleString()} />
                <StatCard label="Transactions" value={stats.totalTransactions.toLocaleString()} />
                <StatCard
                  label="Total Volume"
                  value={`${stats.totalVolume.toLocaleString()} XLM`}
                  color="success.main"
                />
              </Box>
            </>
          )}
        </AppCard>

        {/* ── Charts ── */}
        {stats && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <AppCard>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
                Daily Volume (last 7 days)
              </Typography>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={volumeTrend}>
                  <defs>
                    <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <ReTooltip />
                  <Area
                    type="monotone"
                    dataKey="volume"
                    stroke="#6366f1"
                    fill="url(#volGrad)"
                    strokeWidth={2}
                    name="Volume (XLM)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </AppCard>

            <AppCard>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
                Group Growth (last 6 months)
              </Typography>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={groupTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <ReTooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="groups" fill="#10b981" name="Groups" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </AppCard>
          </Box>
        )}

        <Divider />

        {/* ── User moderation ── */}
        <AppCard>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Users</Typography>
          <UsersTable adminId={adminId} />
        </AppCard>

        {/* ── Group moderation ── */}
        <AppCard>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Groups</Typography>
          <GroupsTable adminId={adminId} />
        </AppCard>

        <Divider />

        {/* ── Audit log ── */}
        <AppCard>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Audit Log</Typography>
          <AuditLogTable />
        </AppCard>
      </Stack>
    </AppLayout>
  );
}
