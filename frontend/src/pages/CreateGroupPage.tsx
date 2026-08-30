import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CreateGroupForm } from '../components/CreateGroupForm';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { useWallet } from '../hooks/useWallet';
import { queryKeys } from '../lib/queryKeys';
import { updateInsuranceSettings } from '../utils/insuranceApi';

import type { GroupData } from '../utils/groupApi';

const CreateGroupPage: React.FC = () => {
  const { activeAddress } = useWallet();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const handleSubmit = async (data: GroupData) => {
    if (!activeAddress) {
      setTxError('Please connect your Freighter wallet first!');
      return;
    }

    setIsSubmitting(true);
    setTxError(null);

    try {
      // TODO: Replace with actual Soroban contract call

      // Simulate a group ID returned from the contract
      const mockGroupId = `group-${Date.now()}`;

      // Persist insurance settings if enabled
      if (data.insuranceEnabled) {
        await updateInsuranceSettings(mockGroupId, {
          enabled: true,
          premiumRate: data.insurancePremiumRate / 100,
        });
      }

      // A brand-new group should show up in the shared groups list the
      // next time GroupsPage/BrowseGroupsPage read from the cache.
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all() });
      setTimeout(() => navigate('/dashboard'), 2500);
    } catch (error) {
      console.error('Failed to create group:', error);
      setTxError('Failed to create group. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => navigate('/dashboard');

  return (
    <div className="create-group-page">
      <div className="page-header">
        <h1>Create New ROSCA Group</h1>
        <p className="page-subtitle">
          Set up a new Rotating Savings and Credit Association group
        </p>
      </div>

      <CreateGroupForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isSubmitting}
      />

      {isSubmitting && <LoadingState message="Submitting transaction to Stellar…" />}

      {txError && !isSubmitting && (
        <ErrorState
          message={txError}
          onRetry={() => setTxError(null)}
          retryLabel="Dismiss"
        />
      )}
    </div>
  );
};

export default CreateGroupPage;