import { useEffect, useState } from 'react';
import { Stack, Typography, Alert } from '@mui/material';
import { AppLayout, AppCard } from '../ui';
import { MemberDirectory } from '../components/MemberDirectory';
import { useNavigation } from '../routing/useNavigation';
import { useWallet } from '../hooks/useWallet';
import type { MemberProfile } from '../types/member';

// ── Mock data ─────────────────────────────────────────────────────────────────

function buildMockMembers(groupId: string): MemberProfile[] {
  void groupId;
  const now = new Date();
  return [
    {
      address: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJ',
      name: 'Alice Okonkwo',
      joinDate: new Date('2026-01-10'),
      contributionCount: 6,
      totalContributed: 1500,
      payoutPosition: 1,
      totalMembers: 8,
      hasReceivedPayout: true,
      status: 'active',
      streak: 6,
      lastContributedAt: new Date(now.getTime() - 86400000 * 2),
    },
    {
      address: 'GDEF0987654321FEDCBAZYXWVUTSRQPONMLKJIHGFEDCBA0987654321FED',
      name: 'Bob Mensah',
      joinDate: new Date('2026-01-12'),
      contributionCount: 5,
      totalContributed: 1250,
      payoutPosition: 2,
      totalMembers: 8,
      hasReceivedPayout: false,
      status: 'active',
      streak: 5,
      lastContributedAt: new Date(now.getTime() - 86400000 * 3),
    },
    {
      address: 'GXYZ1111222233334444555566667777888899990000AAAABBBBCCCCDDDD',
      name: 'Carol Adeyemi',
      joinDate: new Date('2026-01-15'),
      contributionCount: 4,
      totalContributed: 1000,
      payoutPosition: 3,
      totalMembers: 8,
      hasReceivedPayout: false,
      status: 'active',
      streak: 4,
    },
    {
      address: 'GAAA5555666677778888999900001111222233334444555566667777AAAA',
      name: 'Dave Nwosu',
      joinDate: new Date('2026-02-01'),
      contributionCount: 3,
      totalContributed: 750,
      payoutPosition: 4,
      totalMembers: 8,
      hasReceivedPayout: false,
      status: 'inactive',
      streak: 0,
    },
    {
      address: 'GBBB1234ABCD5678EFGH9012IJKL3456MNOP7890QRST1234UVWX5678YZ',
      name: 'Eve Osei',
      joinDate: new Date('2026-02-10'),
      contributionCount: 3,
      totalContributed: 750,
      payoutPosition: 5,
      totalMembers: 8,
      hasReceivedPayout: false,
      status: 'active',
      streak: 3,
    },
    {
      address: 'GCCC9876ZYXW5432VUTS1098RQPO6543NMLK2109JIHG7654FEDC3210BA',
      joinDate: new Date('2026-02-15'),
      contributionCount: 2,
      totalContributed: 500,
      payoutPosition: 6,
      totalMembers: 8,
      hasReceivedPayout: false,
      status: 'pending',
      streak: 2,
    },
    {
      address: 'GDDD1111AAAA2222BBBB3333CCCC4444DDDD5555EEEE6666FFFF7777GG',
      name: 'Grace Asante',
      joinDate: new Date('2026-03-01'),
      contributionCount: 1,
      totalContributed: 250,
      payoutPosition: 7,
      totalMembers: 8,
      hasReceivedPayout: false,
      status: 'active',
      streak: 1,
    },
    {
      address: 'GEEE8888HHHH9999IIII0000JJJJ1111KKKK2222LLLL3333MMMM4444NN',
      name: 'Henry Boateng',
      joinDate: new Date('2026-03-05'),
      contributionCount: 1,
      totalContributed: 250,
      payoutPosition: 8,
      totalMembers: 8,
      hasReceivedPayout: false,
      status: 'active',
      streak: 1,
    },
  ];
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MemberDirectoryPage() {
  const { params } = useNavigation();
  const { activeAddress } = useWallet();
  const groupId = params.groupId ?? 'demo-group';

  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    // Simulate async fetch
    const timer = setTimeout(() => {
      try {
        setMembers(buildMockMembers(groupId));
      } catch {
        setError('Failed to load members.');
      } finally {
        setIsLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [groupId]);

  return (
    <AppLayout
      title="Member Directory"
      subtitle={`Group ${groupId}`}
      footerText="Stellar Save - Built for transparent, on-chain savings"
    >
      <Stack spacing={3}>
        {error && <Alert severity="error">{error}</Alert>}

        <AppCard>
          <Stack spacing={1} sx={{ mb: 2 }}>
            <Typography variant="h5" fontWeight={700}>Member Directory</Typography>
            <Typography variant="body2" color="text.secondary">
              Browse, search, and filter all members in this savings group.
            </Typography>
          </Stack>

          <MemberDirectory
            members={members}
            isLoading={isLoading}
            error={error}
            currentUserAddress={activeAddress ?? undefined}
            groupId={groupId}
          />
        </AppCard>
      </Stack>
    </AppLayout>
  );
}
