
import { useState } from 'react';
import { Stack, Typography, Box } from '@mui/material';
import { AppCard, AppLayout } from '../ui';
import { useWallet } from '../hooks/useWallet';
import { useUserProfile } from '../hooks/useUserProfile';
import { useTransactions } from '../hooks/useTransactions';
import { UserStats } from '../components/UserStats';
import { SettingsSection } from '../components/SettingsSection';
import TransactionTable from '../components/TransactionTables';
import type { Transaction } from '../types/transaction';

/**
 * Profile page - user profile, stats, participation history, and settings
 */
export default function ProfilePage() {
  const { activeAddress } = useWallet();
  const { profile, isLoading: profileLoading } = useUserProfile(activeAddress || undefined);
  const { transactions, isLoading: transactionsLoading } = useTransactions();
  const [activeTab, setActiveTab] = useState('overview');

  const handleTransactionClick = (tx: Transaction) => {
    // In a real app, this would open a transaction detail modal
    console.log('Transaction clicked:', tx);
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'history', label: 'Transaction History' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <AppLayout
      title="Profile"
      subtitle="Your account information and settings"
      footerText="Stellar Save - Built for transparent, on-chain savings"
    >
      <Stack spacing={3}>
        {/* Profile Header */}
        <AppCard>
          <Stack spacing={2}>
            <Typography variant="h2">Profile</Typography>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { xs: 'flex-start', sm: 'center' } }}>
              <Typography color="text.secondary">
                Wallet Address: {activeAddress || 'Not connected'}
              </Typography>
              {profile && (
                <Typography color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                  Member since: {profile.joinDate.toLocaleDateString()}
                </Typography>
              )}
            </Box>
          </Stack>
        </AppCard>

        {/* Tabbed Content */}
        <AppCard>
          {/* Custom Tab Headers */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Box sx={{ display: 'flex', gap: 0 }}>
              {tabs.map((tab) => (
                <Box
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  sx={{
                    px: 3,
                    py: 2,
                    cursor: 'pointer',
                    borderBottom: activeTab === tab.id ? 2 : 0,
                    borderColor: 'primary.main',
                    bgcolor: activeTab === tab.id ? 'action.selected' : 'transparent',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                    transition: 'all 0.2s',
                  }}
                >
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: activeTab === tab.id ? 600 : 400,
                      color: activeTab === tab.id ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    {tab.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Box sx={{ mt: 3 }}>
            {activeTab === 'overview' && (
              <Stack spacing={3}>
                {profileLoading ? (
                  <Typography>Loading profile...</Typography>
                ) : profile ? (
                  <UserStats stats={profile.stats} />
                ) : (
                  <Typography>No profile data available</Typography>
                )}
              </Stack>
            )}

            {activeTab === 'history' && (
              <Stack spacing={3}>
                <Typography variant="h3">Transaction History</Typography>
                <TransactionTable
                  transactions={transactions}
                  isLoading={transactionsLoading}
                  onRowClick={handleTransactionClick}
                />
              </Stack>
            )}

            {activeTab === 'settings' && (
              <SettingsSection />
            )}
          </Box>
        </AppCard>
      </Stack>
    </AppLayout>
  );
}
