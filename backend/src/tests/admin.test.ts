import { AdminService } from '../admin_service';

async function runTests() {
  console.log('🧪 Running Admin Service Tests...');

  const adminService = new AdminService();
  const adminId = 'admin_001';

  // Test Platform Stats
  console.log('Testing platform stats...');
  const stats = adminService.getPlatformStats();
  if (stats.totalUsers > 0 && stats.totalGroups > 0 && stats.totalVolume >= 0) {
    console.log('✅ Platform stats passed');
  } else {
    console.error('❌ Platform stats failed');
    process.exit(1);
  }

  // Test User Management
  console.log('Testing user management...');
  const users = adminService.getUsers();
  const userId = users[0].id;
  
  const user = adminService.getUserById(userId);
  if (user && user.id === userId) {
    console.log('✅ Get user by ID passed');
  } else {
    console.error('❌ Get user by ID failed');
    process.exit(1);
  }

  console.log('Testing update user...');
  const updatedUser = adminService.updateUser(userId, { name: 'Updated Name' }, adminId);
  if (updatedUser && updatedUser.name === 'Updated Name') {
    console.log('✅ Update user passed');
  } else {
    console.error('❌ Update user failed');
    process.exit(1);
  }

  // Test Audit Logs
  console.log('Testing audit logs...');
  const logs = adminService.getAuditLogs();
  const updateLog = logs.find(l => l.action === 'UPDATE_USER' && l.targetId === userId);
  if (updateLog) {
    console.log('✅ Audit logging for update passed');
  } else {
    console.error('❌ Audit logging for update failed');
    process.exit(1);
  }

  console.log('Testing delete user...');
  const success = adminService.deleteUser(userId, adminId);
  if (success && !adminService.getUserById(userId)) {
    console.log('✅ Delete user passed');
  } else {
    console.error('❌ Delete user failed');
    process.exit(1);
  }

  const deleteLog = adminService.getAuditLogs().find(l => l.action === 'DELETE_USER' && l.targetId === userId);
  if (deleteLog) {
    console.log('✅ Audit logging for delete passed');
  } else {
    console.error('❌ Audit logging for delete failed');
    process.exit(1);
  }

  console.log('ALL ADMIN TESTS PASSED! 🎉');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
