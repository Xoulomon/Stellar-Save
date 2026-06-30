export interface DashboardStats {
  totalBalance: number;
  nextPayoutAmount: number;
  nextPayoutDate: string;
  currency: string;
}

export interface DashboardGroup {
  id: string;
  name: string;
  currentCycle: number;
  totalCycles: number;
  contributionAmount: number;
  currency: string;
  status: 'active' | 'completed' | 'pending';
}

export interface PayoutItem {
  id: string;
  groupName: string;
  amount: number;
  date: string;
  status: 'upcoming' | 'received';
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'payout' | 'fee';
  amount: number;
  currency: string;
  date: string;
  status: 'paid' | 'pending';
}
