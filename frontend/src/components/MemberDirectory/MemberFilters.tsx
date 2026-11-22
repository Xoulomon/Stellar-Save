import type { ChangeEvent } from 'react';
import {
  Stack,
  Typography,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { MemberDirectoryFilters, MemberSortOption } from '../../types/member';

export interface MemberFiltersProps {
  filters: MemberDirectoryFilters;
  onChange: (patch: Partial<MemberDirectoryFilters>) => void;
  totalCount: number;
  filteredCount: number;
}

export function MemberFilters({ filters, onChange, totalCount, filteredCount }: MemberFiltersProps) {
  const { t } = useTranslation();

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      flexWrap="wrap"
    >
      {/* Search */}
      <TextField
        size="small"
        placeholder={t('memberDirectory.searchPlaceholder')}
        value={filters.search}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ search: e.target.value })}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </InputAdornment>
          ),
        }}
        sx={{ minWidth: 220, flexGrow: 1 }}
        inputProps={{ 'aria-label': t('memberDirectory.searchLabel') }}
      />

      {/* Status filter */}
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel id="member-status-label">{t('memberDirectory.status')}</InputLabel>
        <Select
          labelId="member-status-label"
          label={t('memberDirectory.status')}
          value={filters.status}
          onChange={(e: SelectChangeEvent) => onChange({ status: e.target.value as MemberDirectoryFilters['status'] })}
        >
          <MenuItem value="all">{t('memberDirectory.all')}</MenuItem>
          <MenuItem value="active">{t('memberDirectory.active')}</MenuItem>
          <MenuItem value="inactive">{t('memberDirectory.inactive')}</MenuItem>
          <MenuItem value="pending">{t('memberDirectory.pending')}</MenuItem>
        </Select>
      </FormControl>

      {/* Payout filter */}
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel id="payout-filter-label">{t('memberDirectory.payout')}</InputLabel>
        <Select
          labelId="payout-filter-label"
          label={t('memberDirectory.payout')}
          value={filters.hasReceivedPayout}
          onChange={(e: SelectChangeEvent) => onChange({ hasReceivedPayout: e.target.value as MemberDirectoryFilters['hasReceivedPayout'] })}
        >
          <MenuItem value="all">{t('memberDirectory.all')}</MenuItem>
          <MenuItem value="yes">{t('memberDirectory.receivedFilter')}</MenuItem>
          <MenuItem value="no">{t('memberDirectory.pendingFilter')}</MenuItem>
        </Select>
      </FormControl>

      {/* Sort */}
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel id="member-sort-label">{t('memberDirectory.sortBy')}</InputLabel>
        <Select
          labelId="member-sort-label"
          label={t('memberDirectory.sortBy')}
          value={filters.sort}
          onChange={(e: SelectChangeEvent) => onChange({ sort: e.target.value as MemberSortOption })}
        >
          <MenuItem value="contributions-desc">{t('memberDirectory.mostContributions')}</MenuItem>
          <MenuItem value="contributions-asc">{t('memberDirectory.fewestContributions')}</MenuItem>
          <MenuItem value="join-date-desc">{t('memberDirectory.newestMembers')}</MenuItem>
          <MenuItem value="join-date-asc">{t('memberDirectory.oldestMembers')}</MenuItem>
          <MenuItem value="name-asc">{t('memberDirectory.nameAscending')}</MenuItem>
          <MenuItem value="name-desc">{t('memberDirectory.nameDescending')}</MenuItem>
          <MenuItem value="payout-position-asc">{t('memberDirectory.payoutPositionAscending')}</MenuItem>
          <MenuItem value="payout-position-desc">{t('memberDirectory.payoutPositionDescending')}</MenuItem>
        </Select>
      </FormControl>

      {/* Result count */}
      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', alignSelf: 'center' }}>
        {filteredCount === totalCount
          ? totalCount === 1 ? t('memberDirectory.oneMember') : t('memberDirectory.manyMembers', { count: totalCount })
          : t('memberDirectory.filteredCount', { filtered: filteredCount, total: totalCount })}
      </Typography>
    </Stack>
  );
}

export const FiltersBar = MemberFilters;
