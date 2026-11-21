import { mockMembers, mockGroups, mockTransactions, mockAuditLogs } from './mock_data';

import type { AuditLog, Member, Group, Transaction } from './models';

/**
 * Admin service providing platform management capabilities.
 *
 * Refactored for dependency injection (Issue #1701):
 * - Data sources are accepted via constructor deps
 * - Tests can provide custom datasets without touching mock_data
 */

export interface AdminServiceDeps {
  members?: Member[];
  groups?: Group[];
  transactions?: Transaction[];
  auditLogs?: AuditLog[];
}

export class AdminService {
  private auditLogs: AuditLog[];
  private members: Member[];
  private groups: Group[];
  private transactions: Transaction[];

  constructor(deps?: AdminServiceDeps) {
    this.members = [...(deps?.members ?? mockMembers)];
    this.groups = [...(deps?.groups ?? mockGroups)];
    this.transactions = [...(deps?.transactions ?? mockTransactions)];
    this.auditLogs = [...(deps?.auditLogs ?? mockAuditLogs)];
  }

  getPlatformStats() {
    return {
      totalUsers: this.members.length,
      totalGroups: this.groups.length,
      totalTransactions: this.transactions.length,
      totalVolume: this.transactions.reduce((acc, tx) => acc + tx.amount, 0),
      systemHealth: 'Healthy',
      lastBackup: Date.now() - 3600000, // Mock 1 hour ago
    };
  }

  getUsers() {
    return this.members;
  }

  getUserById(id: string) {
    return this.members.find((u) => u.id === id);
  }

  updateUser(id: string, updates: Partial<Member>, adminId: string) {
    const index = this.members.findIndex((u) => u.id === id);
    if (index === -1) return null;

    this.members[index] = { ...this.members[index], ...updates };
    this.logAction(adminId, 'UPDATE_USER', id, 'Member', updates);
    return this.members[index];
  }

  deleteUser(id: string, adminId: string) {
    const index = this.members.findIndex((u) => u.id === id);
    if (index === -1) return false;

    this.members.splice(index, 1);
    this.logAction(adminId, 'DELETE_USER', id, 'Member');
    return true;
  }

  getAuditLogs() {
    return this.auditLogs;
  }

  logAction(
    adminId: string,
    action: string,
    targetId?: string,
    targetType?: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AuditLog.metadata is an open-ended JSON bag; tightening requires a schema migration
    metadata?: Record<string, unknown>
  ) {
    const log: AuditLog = {
      id: `log_${Date.now()}`,
      userId: adminId,
      action,
      targetId,
      targetType,
      timestamp: Date.now(),
      metadata,
    };
    this.auditLogs.unshift(log);
  }
}
