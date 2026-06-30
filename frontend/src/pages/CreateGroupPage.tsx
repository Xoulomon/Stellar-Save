import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateGroupForm } from '../components/CreateGroupForm';
import { useWallet } from '../hooks/useWallet';
import { updateInsuranceSettings } from '../utils/insuranceApi';
import type { GroupData } from '../utils/groupApi';

const CreateGroupPage: React.FC = () => {
  const { activeAddress } = useWallet();
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txStatus, setTxStatus] = useState<string>('');

  const handleSubmit = async (data: GroupData) => {
    if (!activeAddress) {
      alert("Please connect your Freighter wallet first!");
      return;
    }

    setIsSubmitting(true);
    setTxStatus("Submitting transaction to Stellar…");

    try {
      // TODO: Replace with actual Soroban contract call
      console.log("Creating group with data:", data);

      // Simulate a group ID returned from the contract
      const mockGroupId = `group-${Date.now()}`;

      // Persist insurance settings if enabled
      if (data.insuranceEnabled) {
        setTxStatus("Configuring insurance pool…");
        await updateInsuranceSettings(mockGroupId, {
          enabled: true,
          premiumRate: data.insurancePremiumRate / 100,
        });
      }

      setTxStatus("✅ Group created successfully!");
      setTimeout(() => navigate('/dashboard'), 2500);
    } catch (error) {
      console.error("Failed to create group:", error);
      setTxStatus("❌ Failed to create group. Please try again.");
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

      {txStatus && (
        <div className="tx-status-message">
          <p>{txStatus}</p>
        </div>
      )}
    </div>
  );
};

export default CreateGroupPage;