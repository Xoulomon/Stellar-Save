import { useState, useCallback } from 'react';

import { useTransactions } from './useTransactions';
import { useUserProfile } from './useUserProfile';
import { useWallet } from './useWallet';

export interface ProfileFormState {
  displayName: string;
  editingName: boolean;
  nameInput: string;
}

export interface UseProfileDataReturn {
  /** Wallet + on-chain data */
  activeAddress: string | null;
  profile: ReturnType<typeof useUserProfile>['profile'];
  isLoading: boolean;
  error: string | null;
  transactions: ReturnType<typeof useTransactions>['transactions'];
  /** Editable display name with inline-edit state */
  formState: ProfileFormState;
  /** Begin editing the display name */
  startEditName: () => void;
  /** Cancel inline edit without saving */
  cancelEditName: () => void;
  /** Commit the new display name */
  confirmEditName: () => void;
  /** Update the name input value while typing */
  setNameInput: (value: string) => void;
  /** Feedback message (e.g. "Settings saved") */
  feedback: string | null;
  /** Show a transient feedback message */
  showFeedback: (msg: string) => void;
}

/**
 * Aggregates all data and interaction state for ProfilePage.
 * The page container and section components depend only on this hook's return value.
 */
export function useProfileData(): UseProfileDataReturn {
  const { activeAddress } = useWallet();
  const { profile, isLoading, error } = useUserProfile(activeAddress ?? undefined);
  const { transactions } = useTransactions();

  const [displayName, setDisplayName] = useState('Stellar Saver');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInputState] = useState('Stellar Saver');
  const [feedback, setFeedback] = useState<string | null>(null);

  const startEditName = useCallback(() => {
    setNameInputState(displayName);
    setEditingName(true);
  }, [displayName]);

  const cancelEditName = useCallback(() => {
    setEditingName(false);
  }, []);

  const confirmEditName = useCallback(() => {
    const trimmed = nameInput.trim();
    if (trimmed) setDisplayName(trimmed);
    setEditingName(false);
  }, [nameInput]);

  const setNameInput = useCallback((value: string) => {
    setNameInputState(value);
  }, []);

  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  }, []);

  return {
    activeAddress,
    profile,
    isLoading,
    error,
    transactions,
    formState: { displayName, editingName, nameInput },
    startEditName,
    cancelEditName,
    confirmEditName,
    setNameInput,
    feedback,
    showFeedback,
  };
}
