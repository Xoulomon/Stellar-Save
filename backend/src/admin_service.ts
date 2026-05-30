import { AuditLog, Member, Group, Transaction } from './models';
import { mockMembers, mockGroups, mockTransactions, mockAuditLogs } from './mock_data';

export class AdminService {
  private auditLogs: AuditLog[] = [...mockAuditLogs];
  private members: Member[] = [...mockMembers];
  private groups: Group[] = [...mockGroups];
  private transactions: Transaction[] = [...mockTransactions];

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
    return this.members.find(u => u.id === id);
  }

  updateUser(id: string, updates: Partial<Member>, adminId: string) {
    const index = this.members.findIndex(u => u.id === id);
    if (index === -1) return null;
    
    this.members[index] = { ...this.members[index], ...updates };
    this.logAction(adminId, 'UPDATE_USER', id, 'Member', updates);
    return this.members[index];
  }

  deleteUser(id: string, adminId: string) {
    const index = this.members.findIndex(u => u.id === id);
    if (index === -1) return false;
    
    this.members.splice(index, 1);
    this.logAction(adminId, 'DELETE_USER', id, 'Member');
    return true;
  }

  getAuditLogs() {
    return this.auditLogs;
  }

  private logAction(adminId: string, action: string, targetId?: string, targetType?: string, metadata?: any) {
    const log: AuditLog = {
      id: `log_${Date.now()}`,
      userId: adminId,
      action,
      targetId,
      targetType,
      timestamp: Date.now(),
      metadata
    };
    this.auditLogs.unshift(log);
  }
}
