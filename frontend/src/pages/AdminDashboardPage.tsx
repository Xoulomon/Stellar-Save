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
 * The page is now a composition layer only: presentation lives in
 * `components/admin/` and the data layer in `hooks/useAdminQueries.ts`.
 *
 * Access is guarded by AdminRoute — non-admin wallets are redirected before
 * this component mounts.
 */
import { Divider, Stack, Typography } from '@mui/material';

import {
  AuditLogTable,
  GroupsTable,
  PlatformOverview,
  UsersTable,
} from '../components/admin';
import { useWallet } from '../hooks/useWallet';
import { AppCard, AppLayout } from '../ui';

export default function AdminDashboardPage() {
  const { activeAddress } = useWallet();
  const adminId = activeAddress ?? '';

  return (
    <AppLayout
      title="Admin Dashboard"
      subtitle="Platform health, moderation, and audit logs"
      footerText="Stellar Save"
    >
      <Stack spacing={3}>
        <PlatformOverview />

        <Divider />

        {/* ── User moderation ── */}
        <AppCard>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            Users
          </Typography>
          <UsersTable adminId={adminId} />
        </AppCard>

        {/* ── Group moderation ── */}
        <AppCard>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            Groups
          </Typography>
          <GroupsTable adminId={adminId} />
        </AppCard>

        <Divider />

        {/* ── Audit log ── */}
        <AppCard>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            Audit Log
          </Typography>
          <AuditLogTable />
        </AppCard>
      </Stack>
    </AppLayout>
  );
}
