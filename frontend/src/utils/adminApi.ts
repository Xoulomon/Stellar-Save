/**
 * Admin API client — wraps the backend AdminService endpoints.
 *
 * The admin identity is verified server-side. On the frontend the role check
 * is an optimistic guard (derived from VITE_ADMIN_ADDRESSES) that hides the
 * route from non-admins before any API call is made.
 */

const API_BASE = (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? '/api/v1';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlatformStats {
  totalUsers: number;
  totalGroups: number;
  totalTransactions: number;
  totalVolume: number;
  systemHealth: string;
  lastBackup: number;
}

export interface AdminUser {
  id: string;
  address: string;
  name: string;
  joinedAt: number;
  groupIds: string[];
  flagged?: boolean;
}

export interface AdminGroup {
  id: string;
  name: string;
  contributionAmount: number;
  cycleDuration: number;
  maxMembers: number;
  currentMembers: number;
  status: string;
  tags: string[];
  flagged?: boolean;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  targetId?: string;
  targetType?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// ── Platform stats ────────────────────────────────────────────────────────────

export async function fetchPlatformStats(): Promise<PlatformStats> {
  const res = await fetch(`${API_BASE}/admin/stats`);
  if (!res.ok) throw new Error('Failed to fetch platform stats');
  return res.json() as Promise<PlatformStats>;
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const res = await fetch(`${API_BASE}/admin/users`);
  if (!res.ok) throw new Error('Failed to fetch users');
  const data = await res.json() as { users: AdminUser[] };
  return data.users;
}

export async function updateAdminUser(
  id: string,
  updates: Partial<AdminUser>,
  adminId: string,
): Promise<AdminUser> {
  const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates, adminId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Update failed' })) as { error: string };
    throw new Error(err.error ?? 'Update failed');
  }
  return res.json() as Promise<AdminUser>;
}

export async function deleteAdminUser(id: string, adminId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Delete failed' })) as { error: string };
    throw new Error(err.error ?? 'Delete failed');
  }
}

// ── Groups ────────────────────────────────────────────────────────────────────

export async function fetchAdminGroups(): Promise<AdminGroup[]> {
  const res = await fetch(`${API_BASE}/admin/groups`);
  if (!res.ok) throw new Error('Failed to fetch groups');
  const data = await res.json() as { groups: AdminGroup[] };
  return data.groups;
}

export async function flagGroup(
  groupId: string,
  flagged: boolean,
  adminId: string,
): Promise<AdminGroup> {
  const res = await fetch(`${API_BASE}/admin/groups/${encodeURIComponent(groupId)}/flag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flagged, adminId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Flag action failed' })) as { error: string };
    throw new Error(err.error ?? 'Flag action failed');
  }
  return res.json() as Promise<AdminGroup>;
}

// ── Audit logs ────────────────────────────────────────────────────────────────

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const res = await fetch(`${API_BASE}/admin/audit-logs`);
  if (!res.ok) throw new Error('Failed to fetch audit logs');
  const data = await res.json() as { logs: AuditLog[] };
  return data.logs;
}

// ── Role check ────────────────────────────────────────────────────────────────

/**
 * Returns true if the given wallet address is in the admin allowlist.
 * The allowlist is injected at build time via VITE_ADMIN_ADDRESSES (comma-separated).
 * Server-side auth is the real gate — this is a UI-only optimistic guard.
 */
export function isAdminAddress(address: string): boolean {
  const raw = (import.meta.env['VITE_ADMIN_ADDRESSES'] as string | undefined) ?? '';
  if (!raw) return false;
  return raw.split(',').map((a) => a.trim()).includes(address);
}
