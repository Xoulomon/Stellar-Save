import { useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Stack, Typography } from '@mui/material';
import { AppCard, AppLayout } from '../ui';
import { GroupList } from '../components/GroupList';
import { Button } from '../components/Button';
import { useGroups } from '../hooks/useGroups';
import { ROUTES } from '../routing/constants';

/**
 * Groups page — search, filter by token type and amount range,
 * with all filter state persisted in URL query params.
 */
export default function GroupsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const search = params.get('search') ?? '';
  const currency = params.get('currency') ?? '';
  const minAmount = params.get('minAmount') ?? '';
  const maxAmount = params.get('maxAmount') ?? '';

  const setParam = useCallback(
    (key: string, value: string) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      });
    },
    [setParams],
  );

  const { groups, isLoading, error, refresh } = useGroups({
    initialFilters: { search, minAmount, maxAmount },
  });

  // Map PublicGroup → GroupList Group (shapes are compatible)
  const listGroups = groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    memberCount: g.memberCount,
    contributionAmount: g.contributionAmount,
    currency: g.currency,
    createdAt: g.createdAt,
  }));

  return (
    <AppLayout
      title="Groups"
      subtitle="Browse and join savings groups"
      footerText="Stellar Save - Built for transparent, on-chain savings"
      navItems={[
        { key: 'create', label: 'Create Group', onClick: () => navigate(ROUTES.GROUP_CREATE) },
      ]}
    >
      <AppCard>
        <Stack spacing={2}>
          <Typography variant="h2">Savings Groups</Typography>

          {error && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography color="error">{error}</Typography>
              <Button variant="secondary" size="small" onClick={refresh}>Retry</Button>
            </Stack>
          )}

          <GroupList
            groups={listGroups}
            loading={isLoading}
            searchQuery={search}
            onSearchChange={(v) => setParam('search', v)}
            currencyFilter={currency}
            onCurrencyChange={(v) => setParam('currency', v)}
            minAmount={minAmount}
            maxAmount={maxAmount}
            onMinAmountChange={(v) => setParam('minAmount', v)}
            onMaxAmountChange={(v) => setParam('maxAmount', v)}
            onGroupClick={(g) => navigate(`/groups/${g.id}`)}
            emptyTitle="No groups found"
            emptyDescription="Try adjusting your search or filters."
          />
        </Stack>
      </AppCard>
    </AppLayout>
  );
}
