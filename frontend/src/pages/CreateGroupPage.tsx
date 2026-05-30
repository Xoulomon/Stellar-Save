import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateGroupForm } from '../components/CreateGroupForm';
import { useWallet } from '../hooks/useWallet';
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
    setTxStatus("Submitting transaction to Stellar...");

    try {
      // TODO: Replace with actual Soroban contract call
      console.log("Creating group with data:", data);
      
      // Example contract call (you'll implement this later):
      // const result = await createGroup({
      //   name: data.name,
      //   description: data.description,
      //   contributionAmount: BigInt(data.contributionAmount),
      //   cycleDuration: BigInt(data.cycleDuration),
      //   maxMembers: Number(data.maxMembers),
      //   minMembers: Number(data.minMembers),
      // });

      setTxStatus("✅ Group created successfully!");
      
      // Redirect to dashboard after short delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 2500);

    } catch (error) {
      console.error("Failed to create group:", error);
      setTxStatus("❌ Failed to create group. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/dashboard');
  };

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