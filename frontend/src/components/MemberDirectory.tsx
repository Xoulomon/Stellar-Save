import { useState } from 'react';
import { Box, Stack, Typography, Grid, Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';

import type { MemberProfile, MemberDirectoryFilters } from '../types/member';
import { DEFAULT_MEMBER_FILTERS } from '../types/member';
import { applyFilters, applySort } from '../utils/memberFilters';
import { MemberFilters } from './MemberDirectory/MemberFilters';
import { MemberDirectoryCard, MemberCardSkeleton } from './MemberDirectory/MemberRow';
import { VirtualizedList } from './VirtualizedList';

export interface MemberDirectoryProps {
  members: MemberProfile[];
  isLoading?: boolean;
  error?: string | null;
  currentUserAddress?: string;
  groupId?: string;
  title?: string;
}

export function MemberDirectory({
  members,
  isLoading = false,
  error = null,
  currentUserAddress,
  groupId,
  title,
}: MemberDirectoryProps) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<MemberDirectoryFilters>(DEFAULT_MEMBER_FILTERS);

  const handleFilterChange = (patch: Partial<MemberDirectoryFilters>) => {
    setFilters((prev: MemberDirectoryFilters) => ({ ...prev, ...patch }));
  };

  const handleClearFilters = () => {
    setFilters(DEFAULT_MEMBER_FILTERS);
  };

  const filtered = applyFilters(members, filters);
  const sorted = applySort(filtered, filters.sort);

  const hasActiveFilters =
    filters.search.trim() !== '' ||
    filters.status !== 'all' ||
    filters.hasReceivedPayout !== 'all';

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>
          {title ?? t('memberDirectory.title')}
        </Typography>
        {hasActiveFilters && (
          <Box
            component="button"
            onClick={handleClearFilters}
            sx={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'primary.main', fontSize: '0.875rem', fontWeight: 500,
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {t('memberDirectory.clearFilters')}
          </Box>
        )}
      </Box>

      <MemberFilters
        filters={filters}
        onChange={handleFilterChange}
        totalCount={members.length}
        filteredCount={filtered.length}
      />

      {error && <Alert severity="error">{error}</Alert>}

      {isLoading ? (
        <Grid container spacing={2}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <MemberCardSkeleton />
            </Grid>
          ))}
        </Grid>
      ) : sorted.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center', py: 8,
            border: '1px dashed', borderColor: 'divider', borderRadius: 3,
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {hasActiveFilters ? t('memberDirectory.noMatches') : t('memberDirectory.noMembers')}
          </Typography>
          {hasActiveFilters && (
            <Box
              component="button"
              onClick={handleClearFilters}
              sx={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'primary.main', fontSize: '0.875rem',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {t('memberDirectory.clearFilters')}
            </Box>
          )}
        </Box>
      ) : sorted.length > 100 ? (
        <VirtualizedList
          items={sorted}
          itemHeight={380}
          getKey={(member) => member.address}
          label="Member directory results"
          renderItem={(member) => (
            <Box sx={{ height: '100%', pb: 2, boxSizing: 'border-box' }}>
              <MemberDirectoryCard
                member={member}
                isCurrentUser={member.address === currentUserAddress}
                groupId={groupId}
              />
            </Box>
          )}
        />
      ) : (
        <Grid container spacing={2}>
          {sorted.map((member: MemberProfile) => (
            <Grid item xs={12} sm={6} md={4} key={member.address}>
              <MemberDirectoryCard
                member={member}
                isCurrentUser={member.address === currentUserAddress}
                groupId={groupId}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Stack>
  );
}

export default MemberDirectory;
