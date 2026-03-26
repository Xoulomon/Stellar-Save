import { useState, useEffect } from 'react';

export interface UserStats {
  totalContributed: number;
  totalReceived: number;
  groupsJoined: number;
  activeGroups: number;
  completedCycles: number;
  averageContribution: number;
}

export interface UserProfile {
  address: string;
  name?: string;
  joinDate: Date;
  stats: UserStats;
}

// Mock user profile data - Replace with real API calls later
const mockUserProfile: UserProfile = {
  address: 'GABCD...1234', // Will be replaced with actual wallet address
  name: 'Stellar Saver',
  joinDate: new Date('2026-01-15'),
  stats: {
    totalContributed: 1250,
    totalReceived: 875,
    groupsJoined: 3,
    activeGroups: 2,
    completedCycles: 5,
    averageContribution: 250,
  },
};

export const useUserProfile = (address?: string) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API delay
    const timer = setTimeout(() => {
      // In a real app, this would fetch based on the address
      setProfile({
        ...mockUserProfile,
        address: address || mockUserProfile.address,
      });
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [address]);

  return { profile, isLoading };
};