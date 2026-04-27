import { useState } from 'react';
import {
  Stack,
  Typography,
  Box,
  Avatar as MuiAvatar,
  Divider,
  Switch,
  FormControlLabel,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { AppCard, AppLayout } from '../ui';
import { Button } from '../components/Button';
import { UserStats } from '../components/UserStats';
import TransactionTable from '../components/TransactionTables';
import { useWallet } from '../hooks/useWallet';
import { useUserProfile } from '../hooks/useUserProfile';
import { useTransactions } from '../hooks/useTransactions';
import { useClipboard } from '../hooks/useClipboard';
import type { Transaction } from '../types/transaction';

// ── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'history', label: 'Transaction History' },
  { id: 'settings', label: 'Profile Settings' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Security' },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ── Profile Header ───────────────────────────────────────────────────────────

interface ProfileHeaderProps {
  address: string | null;
  displayName: string;
  joinDate?: Date;
  onEditName: () => void;
}

function ProfileHeader({ address, displayName, joinDate, onEditName }: ProfileHeaderProps) {
  const { copy, copied } = useClipboard();
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, alignItems: { xs: 'flex-start', sm: 'center' } }}>
      <MuiAvatar sx={{ width: 72, height: 72, bgcolor: 'primary.main', fontSize: '1.5rem', fontWeight: 700 }}>
        {initials}
      </MuiAvatar>
      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h2" sx={{ fontWeight: 700 }}>{displayName}</Typography>
          <Tooltip title="Edit display name">
            <IconButton size="small" onClick={onEditName} aria-label="Edit display name">
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        {address ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
              {address.slice(0, 12)}…{address.slice(-8)}
            </Typography>
            <Tooltip title={copied ? 'Copied!' : 'Copy full address'}>
              <IconButton size="small" onClick={() => copy(address)} aria-label="Copy wallet address">
                {copied
                  ? <CheckCircleIcon fontSize="small" color="success" />
                  : <ContentCopyIcon sx={{ fontSize: 14 }} />}
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">Wallet not connected</Typography>
        )}
        {joinDate && (
          <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
            Member since {joinDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </Typography>
        )}
      </Box>
      {address && <Chip label="Verified" color="success" size="small" icon={<CheckCircleIcon />} />}
    </Box>
  );
}

// ── Profile Settings Tab ─────────────────────────────────────────────────────

interface ProfileSettingsProps {
  displayName: string;
  onSave: (name: string, theme: string, language: string) => void;
}

function ProfileSettings({ displayName, onSave }: ProfileSettingsProps) {
  const [name, setName] = useState(displayName);
  const [theme, setTheme] = useState('dark');
  const [language, setLanguage] = useState('en');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave(name, theme, language);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h3">Profile Settings</Typography>
      {saved && <Alert severity="success">Settings saved successfully.</Alert>}
      <TextField
        label="Display Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        fullWidth
        size="small"
        inputProps={{ maxLength: 50 }}
        helperText={`${name.length}/50 characters`}
      />
      <FormControl fullWidth size="small">
        <InputLabel>Theme</InputLabel>
        <Select value={theme} label="Theme" onChange={(e) => setTheme(e.target.value)}>
          <MenuItem value="light">Light</MenuItem>
          <MenuItem value="dark">Dark</MenuItem>
          <MenuItem value="auto">System Default</MenuItem>
        </Select>
      </FormControl>
      <FormControl fullWidth size="small">
        <InputLabel>Language</InputLabel>
        <Select value={language} label="Language" onChange={(e) => setLanguage(e.target.value)}>
          <MenuItem value="en">English</MenuItem>
          <MenuItem value="es">Español</MenuItem>
          <MenuItem value="fr">Français</MenuItem>
          <MenuItem value="pt">Português</MenuItem>
        </Select>
      </FormControl>
      <Box>
        <Button variant="primary" onClick={handleSave}>Save Settings</Button>
      </Box>
    </Stack>
  );
}

// ── Notification Preferences Tab ─────────────────────────────────────────────

function NotificationPreferences() {
  const [prefs, setPrefs] = useState({
    emailContributions: true,
    emailPayouts: true,
    emailGroupUpdates: false,
    pushContributions: false,
    pushPayouts: true,
    pushGroupUpdates: false,
    smsAlerts: false,
  });
  const [saved, setSaved] = useState(false);

  const toggle = (key: keyof typeof prefs) =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const rows: { key: keyof typeof prefs; label: string; description: string }[] = [
    { key: 'emailContributions', label: 'Email — Contributions', description: 'Get notified when a contribution is made in your groups.' },
    { key: 'emailPayouts', label: 'Email — Payouts', description: 'Receive email alerts when a payout is processed.' },
    { key: 'emailGroupUpdates', label: 'Email — Group Updates', description: 'Updates about group membership and settings changes.' },
    { key: 'pushContributions', label: 'Push — Contributions', description: 'Browser push notifications for contributions.' },
    { key: 'pushPayouts', label: 'Push — Payouts', description: 'Browser push notifications for payouts.' },
    { key: 'pushGroupUpdates', label: 'Push — Group Updates', description: 'Browser push notifications for group changes.' },
    { key: 'smsAlerts', label: 'SMS Alerts', description: 'Text message alerts for critical events (requires phone number).' },
  ];

  return (
    <Stack spacing={3}>
      <Typography variant="h3">Notification Preferences</Typography>
      {saved && <Alert severity="success">Notification preferences saved.</Alert>}
      <Stack spacing={1} divider={<Divider />}>
        {rows.map(({ key, label, description }) => (
          <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
            <Box>
              <Typography variant="body2" fontWeight={600}>{label}</Typography>
              <Typography variant="caption" color="text.secondary">{description}</Typography>
            </Box>
            <FormControlLabel
              control={<Switch checked={prefs[key]} onChange={() => toggle(key)} size="small" />}
              label=""
              sx={{ m: 0 }}
            />
          </Box>
        ))}
      </Stack>
      <Box>
        <Button variant="primary" onClick={handleSave}>Save Preferences</Button>
      </Box>
    </Stack>
  );
}

// ── Security Settings Tab ────────────────────────────────────────────────────

function SecuritySettings() {
  const { activeAddress, network } = useWallet();
  const [twoFactor, setTwoFactor] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h3">Security Settings</Typography>
      {saved && <Alert severity="success">Security settings updated.</Alert>}

      {/* Wallet info */}
      <AppCard>
        <Stack spacing={1.5}>
          <Typography variant="body1" fontWeight={600}>Connected Wallet</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">Address</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
              {activeAddress ?? 'Not connected'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">Network</Typography>
            <Chip label={network ?? 'Unknown'} size="small" color={network === 'PUBLIC' ? 'success' : 'warning'} />
          </Box>
        </Stack>
      </AppCard>

      {/* 2FA toggle */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="body2" fontWeight={600}>Two-Factor Authentication</Typography>
          <Typography variant="caption" color="text.secondary">
            Add an extra layer of security to your account.
          </Typography>
        </Box>
        <Switch
          checked={twoFactor}
          onChange={() => setTwoFactor((v) => !v)}
          inputProps={{ 'aria-label': 'Toggle two-factor authentication' }}
        />
      </Box>

      {twoFactor && (
        <Alert severity="info">
          2FA setup would require scanning a QR code with an authenticator app. (Demo only)
        </Alert>
      )}

      {/* Session timeout */}
      <FormControl fullWidth size="small">
        <InputLabel>Session Timeout</InputLabel>
        <Select value={sessionTimeout} label="Session Timeout" onChange={(e) => setSessionTimeout(e.target.value)}>
          <MenuItem value="15">15 minutes</MenuItem>
          <MenuItem value="30">30 minutes</MenuItem>
          <MenuItem value="60">1 hour</MenuItem>
          <MenuItem value="240">4 hours</MenuItem>
          <MenuItem value="0">Never</MenuItem>
        </Select>
      </FormControl>

      <Divider />
      <Alert severity="warning">
        Revoking wallet access will disconnect your wallet and clear all session data.
      </Alert>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button variant="primary" onClick={handleSave}>Save Security Settings</Button>
        <Button variant="secondary">Revoke Wallet Access</Button>
      </Box>
    </Stack>
  );
}

// ── Main ProfilePage ─────────────────────────────────────────────────────────

/**
 * ProfilePage — Issue #444
 * User profile and settings page:
 * - Display user information (avatar, name, address, join date)
 * - Account statistics (contributions, payouts, groups, cycles)
 * - Transaction history table
 * - Profile settings (name, theme, language)
 * - Notification preferences (email, push, SMS toggles)
 * - Security settings (wallet info, 2FA, session timeout)
 * - Responsive design
 */
export default function ProfilePage() {
  const { activeAddress } = useWallet();
  const { profile, isLoading: profileLoading } = useUserProfile(activeAddress ?? undefined);
  const { transactions, isLoading: transactionsLoading } = useTransactions();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [displayName, setDisplayName] = useState('Stellar Saver');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(displayName);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleTransactionClick = (tx: Transaction) => {
    console.log('Transaction clicked:', tx);
  };

  const handleSaveSettings = (name: string, _theme: string, _language: string) => {
    setDisplayName(name);
    setFeedback('Profile settings saved.');
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleConfirmName = () => {
    setDisplayName(nameInput.trim() || displayName);
    setEditingName(false);
  };

  return (
    <AppLayout
      title="Profile"
      subtitle="Your account information and settings"
      footerText="Stellar Save - Built for transparent, on-chain savings"
    >
      <Stack spacing={3}>
        {feedback && <Alert severity="success">{feedback}</Alert>}

        {/* Profile Header Card */}
        <AppCard>
          {editingName ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <TextField
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                size="small"
                label="Display Name"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmName(); if (e.key === 'Escape') setEditingName(false); }}
              />
              <IconButton onClick={handleConfirmName} color="primary" aria-label="Confirm name"><CheckIcon /></IconButton>
              <IconButton onClick={() => setEditingName(false)} aria-label="Cancel edit"><CloseIcon /></IconButton>
            </Box>
          ) : (
            <ProfileHeader
              address={activeAddress}
              displayName={displayName}
              joinDate={profile?.joinDate}
              onEditName={() => { setNameInput(displayName); setEditingName(true); }}
            />
          )}
        </AppCard>

        {/* Tabbed Content */}
        <AppCard>
          {/* Tab Headers */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, overflowX: 'auto' }}>
            <Box sx={{ display: 'flex', gap: 0, minWidth: 'max-content' }}>
              {TABS.map((tab) => (
                <Box
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTab(tab.id); }}
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

          {/* Tab Content */}
          <Box>
            {activeTab === 'overview' && (
              <Stack spacing={3}>
                {profileLoading ? (
                  <Typography color="text.secondary">Loading profile data…</Typography>
                ) : profile ? (
                  <UserStats stats={profile.stats} />
                ) : (
                  <Alert severity="info">
                    Connect your wallet to view account statistics.
                  </Alert>
                )}
              </Stack>
            )}

            {activeTab === 'history' && (
              <Stack spacing={2}>
                <Typography variant="h3">Transaction History</Typography>
                <TransactionTable
                  transactions={transactions}
                  isLoading={transactionsLoading}
                  onRowClick={handleTransactionClick}
                />
              </Stack>
            )}

            {activeTab === 'settings' && (
              <ProfileSettings
                displayName={displayName}
                onSave={handleSaveSettings}
              />
            )}

            {activeTab === 'notifications' && <NotificationPreferences />}

            {activeTab === 'security' && <SecuritySettings />}
          </Box>
        </AppCard>
      </Stack>
    </AppLayout>
  );
}
