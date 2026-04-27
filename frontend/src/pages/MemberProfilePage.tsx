import { useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { AppLayout } from '../ui';
import { UserStats } from '../components/UserStats';
import { StreakDisplay } from '../components/StreakDisplay';
import { Spinner } from '../components/Spinner';
import { useMemberProfile } from '../hooks/useMemberProfile';
import { useClipboard } from '../hooks/useClipboard';

function ReputationBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'success' : score >= 50 ? 'warning' : 'error';
  const label =
    score >= 80 ? 'Trusted' : score >= 50 ? 'Good Standing' : 'New Member';
  return (
    <Tooltip title={`Reputation score: ${score}/100`}>
      <Chip
        label={`${label} · ${score}/100`}
        color={color}
        size="small"
        aria-label={`Reputation: ${score} out of 100`}
      />
    </Tooltip>
  );
}

export default function MemberProfilePage() {
  const { address } = useParams<{ address: string }>();
  const { profile, isLoading, error } = useMemberProfile(address);
  const { copy, copied } = useClipboard();

  const profileUrl = `${window.location.origin}/members/${address ?? ''}`;

  const handleShare = () => copy(profileUrl);

  const initials = profile
    ? profile.displayName.slice(0, 2).toUpperCase()
    : '??';

  return (
    <AppLayout
      title="Member Profile"
      subtitle="Contribution history and reputation"
      footerText="Stellar Save — Built for transparent, on-chain savings"
    >
      {isLoading && (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <Spinner size="lg" />
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {!isLoading && !error && !profile && (
        <Alert severity="warning">Member not found.</Alert>
      )}

      {profile && (
        <Stack spacing={3}>
          {/* ── Header card ── */}
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <Avatar
                sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: '1.4rem', fontWeight: 700 }}
                aria-label={`Avatar for ${profile.displayName}`}
              >
                {initials}
              </Avatar>

              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" fontWeight="bold">{profile.displayName}</Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                  aria-label="Wallet address"
                >
                  {profile.address.slice(0, 12)}…{profile.address.slice(-8)}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Member since{' '}
                  {profile.joinDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                  })}
                </Typography>
              </Box>

              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <ReputationBadge score={profile.reputationScore} />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleShare}
                  aria-label="Copy profile link"
                >
                  {copied ? 'Copied!' : 'Share Profile'}
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {/* ── Reputation score bar ── */}
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Reputation Score
            </Typography>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box sx={{ flex: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={profile.reputationScore}
                  color={
                    profile.reputationScore >= 80
                      ? 'success'
                      : profile.reputationScore >= 50
                      ? 'warning'
                      : 'error'
                  }
                  sx={{ height: 10, borderRadius: 5 }}
                  aria-label={`Reputation score ${profile.reputationScore} out of 100`}
                />
              </Box>
              <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 40 }}>
                {profile.reputationScore}/100
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Based on on-time contributions, group participation, and contribution streak
            </Typography>
          </Paper>

          {/* ── Stats ── */}
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Contribution Statistics
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <UserStats stats={profile.stats} />
          </Paper>

          {/* ── Streak & milestones ── */}
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Contribution Streak &amp; Milestones
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <StreakDisplay
              currentStreak={profile.currentStreak}
              longestStreak={profile.longestStreak}
            />
          </Paper>
        </Stack>
      )}
    </AppLayout>
  );
}
