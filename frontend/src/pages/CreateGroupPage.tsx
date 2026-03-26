import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stack, Typography } from '@mui/material';
import { AppCard, AppLayout } from '../ui';
import { CreateGroupForm } from '../components/CreateGroupForm';
import { createGroup } from '../utils/groupApi';
import type { GroupData } from '../utils/groupApi';
import { ROUTES, buildRoute } from '../routing/constants';

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

interface PageState {
  status: SubmitStatus;
  groupId: string | null;
  errorMessage: string | null;
  groupName: string | null;
}

export default function CreateGroupPage() {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>({
    status: 'idle',
    groupId: null,
    errorMessage: null,
    groupName: null,
  });

  // Task 10: redirect after success
  useEffect(() => {
    if (pageState.status !== 'success') return;
    const timer = setTimeout(() => {
      if (pageState.groupId) {
        navigate(buildRoute.groupDetail(pageState.groupId));
      } else {
        navigate(ROUTES.GROUPS);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [pageState.status, pageState.groupId, navigate]);

  const handleCancel = () => {
    navigate(ROUTES.GROUPS);
  };

  const handleSubmit = async (data: GroupData) => {
    setPageState(prev => ({ ...prev, status: 'loading', errorMessage: null }));
    try {
      const groupId = await createGroup(data);
      setPageState({
        status: 'success',
        groupId,
        errorMessage: null,
        groupName: data.name,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to create group. Please try again.';
      setPageState(prev => ({ ...prev, status: 'error', errorMessage }));
    }
  };

  return (
    <AppLayout
      title="Create Group"
      subtitle="Set up your savings circle"
      footerText="Stellar Save - Built for transparent, on-chain savings"
    >
      <AppCard>
        <Stack spacing={2}>
          {/* aria-live region for status announcements */}
          <div aria-live="polite" aria-atomic="true">
            {pageState.status === 'success' && (
              <Typography color="success.main">
                Group created successfully! Redirecting...
              </Typography>
            )}
            {pageState.status === 'error' && pageState.errorMessage && (
              <Typography color="error.main">{pageState.errorMessage}</Typography>
            )}
          </div>

          {pageState.status === 'success' ? (
            <Typography variant="h6">
              "{pageState.groupName}" has been created! You will be redirected shortly.
            </Typography>
          ) : (
            <CreateGroupForm
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isSubmitting={pageState.status === 'loading'}
            />
          )}
        </Stack>
      </AppCard>
    </AppLayout>
  );
}
