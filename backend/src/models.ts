export interface UserPreference {
  userId: string;
  minContribution?: number;
  maxContribution?: number;
  preferredDuration?: number; // in seconds
  tags: string[];
}

export interface Group {
  id: string;
  name: string;
  contributionAmount: number;
  cycleDuration: number;
  maxMembers: number;
  currentMembers: number;
  status: string;
  tags: string[];
}

export interface UserInteraction {
  userId: string;
  groupId: string;
  interactionType: 'view' | 'join' | 'contribute';
  timestamp: number;
}

export interface Recommendation {
  groupId: string;
  score: number;
  algorithm: string;
}
