import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { Stack, Box, Typography, Alert, TextField, IconButton } from '@mui/material';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import TransactionTable from '../components/TransactionTables';
import { useProfileData } from '../hooks/useProfileData';
import { AppCard, AppLayout } from '../ui';
import { buildRoute } from '../routing/constants';

import {
  ProfileHeader,
  ProfileOverview,
  ProfileSettings,
  NotificationPreferences,
  SecuritySettings,
} from './profile';

import type { Transaction } from '../types/transaction';

// ── Tab config ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'history', label: 'Transaction History' },
  { id: 'settings', label: 'Profile Settings' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Security' },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ── ProfilePage ───────────────────────────────────────────────────────────────

/**
 * ProfilePage — public route export (props unchanged).
 *
 * This is a thin container: all data loading lives in useProfileData,
 * all visual sections live in frontend/src/pages/profile/.
 */
export default function ProfilePage() {
  const { address: routeAddress } = useParams<{ address?: string }>();
  const navigate = useNavigate();

  const {
    activeAddress,
    profile,
    isLoading,
    transactions,
    formState,
    startEditName,
    cancelEditName,
    confirmEditName,
    setNameInput,
    feedback,
    showFeedback,
  } = useProfileData();

  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Redirect to address-scoped URL if not already there
  useEffect(() => {
    if (!routeAddress && activeAddress) {
      navigate(buildRoute.profile(activeAddress), { replace: true });
    }
  }, [routeAddress, activeAddress, navigate]);

  const handleTransactionClick = (_tx: Transaction) => {
    // placeholder — wire up detail modal when available
  };

  const handleSaveSettings = (name: string, _theme: string, _language: string) => {
    showFeedback('Profile settings saved.');
    // name is managed inside ProfileSettings local state; persist here if needed
    void name;
  };

  return (
    <AppLayout
      title="Profile"
      subtitle="Review savings history, total contributions, and group participation."
      footerText="Stellar Save - Built for transparent, on-chain savings"
    >
      <Stack spacing={3}>
        {feedback && <Alert severity="success">{feedback}</Alert>}

        {/* Profile header card */}
        <AppCard>
          {formState.editingName ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <TextField
                value={formState.nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                size="small"
                label="Display Name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmEditName();
                  if (e.key === 'Escape') cancelEditName();
                }}
              />
              <IconButton onClick={confirmEditName} color="primary" aria-label="Confirm name">
                <CheckIcon />
              </IconButton>
              <IconButton onClick={cancelEditName} aria-label="Cancel edit">
                <CloseIcon />
              </IconButton>
            </Box>
          ) : (
            <ProfileHeader
              address={activeAddress}
              displayName={formState.displayName}
              joinDate={profile?.joinDate}
              onEditName={startEditName}
            />
          )}
        </AppCard>

        <AppCard>
          {/* Tab headers */}
          <Box
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, overflowX: 'auto' }}
            role="tablist"
            aria-label="Profile sections"
          >
            <Box sx={{ display: 'flex', gap: 0, minWidth: 'max-content' }}>
              {TABS.map((tab) => (
                <Box
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={activeTab === tab.id}
                  aria-controls={`profile-panel-${tab.id}`}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setActiveTab(tab.id);
                  }}
                  sx={{
                    px: { xs: 2, sm: 3 },
                    py: 2,
                    cursor: 'pointer',
                    borderBottom: activeTab === tab.id ? 2 : 0,
                    borderColor: 'primary.main',
                    bgcolor: activeTab === tab.id ? 'action.selected' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Typography
                    variant="body2"
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

          {/* Tab panels */}
          <Box>
            {activeTab === 'overview' && (
              <Box role="tabpanel" id="profile-panel-overview" aria-labelledby="tab-overview">
                <ProfileOverview profile={profile} isLoading={isLoading} />
              </Box>
            )}

            {activeTab === 'history' && (
              <Stack spacing={2} role="tabpanel" id="profile-panel-history" aria-labelledby="tab-history">
                <Typography variant="h3">Transaction History</Typography>
                <TransactionTable
                  transactions={transactions}
                  isLoading={isLoading}
                  onRowClick={handleTransactionClick}
                />
              </Stack>
            )}

            {activeTab === 'settings' && (
              <Box role="tabpanel" id="profile-panel-settings" aria-labelledby="tab-settings">
                <ProfileSettings displayName={formState.displayName} onSave={handleSaveSettings} />
              </Box>
            )}

            {activeTab === 'notifications' && (
              <Box role="tabpanel" id="profile-panel-notifications" aria-labelledby="tab-notifications">
                <NotificationPreferences />
              </Box>
            )}

            {activeTab === 'security' && (
              <Box role="tabpanel" id="profile-panel-security" aria-labelledby="tab-security">
                <SecuritySettings />
              </Box>
            )}
          </Box>
        </AppCard>
      </Stack>
    </AppLayout>
  );
}
