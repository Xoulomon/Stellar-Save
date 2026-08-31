export type StepOperationType =
  | 'payment'
  | 'contract_call'
  | 'manage_data'
  | 'manage_sell_offer'
  | 'create_group'
  | 'join_group'
  | 'contribute'
  | 'execute_payout';

export interface PaymentStepParams {
  destination: string;
  amount: string;
  asset?: string;
  memo?: string;
}

export interface ContractCallStepParams {
  contractId: string;
  method: string;
  args: Record<string, string>;
}

export interface ManageDataStepParams {
  key: string;
  value: string;
}

export interface ManageSellOfferStepParams {
  selling: string;
  buying: string;
  amount: string;
  price: string;
}

export interface TransactionBuilderStep {
  id: string;
  type: StepOperationType;
  label: string;
  params: Record<string, unknown>;
  enabled: boolean;
}

export interface SimulationResult {
  success: boolean;
  feeEstimate: string;
  feeInXlm: number;
  operationsCount: number;
  footprintBytes: number;
  warnings: string[];
  result?: string;
  error?: string;
}

export interface TransactionTemplate {
  id?: string;
  name: string;
  description: string;
  steps: TransactionBuilderStep[];
  createdAt: number;
  updatedAt: number;
  userId?: string;
  shareCode?: string;
}

export const STEP_TYPE_META: Record<StepOperationType, {
  label: string;
  description: string;
  color: string;
  icon: string;
}> = {
  payment: {
    label: 'Payment',
    description: 'Send XLM or tokens to an address',
    color: '#008f8c',
    icon: '→',
  },
  contract_call: {
    label: 'Contract Call',
    description: 'Invoke a Soroban smart contract method',
    color: '#1f4fd4',
    icon: '◎',
  },
  manage_data: {
    label: 'Manage Data',
    description: 'Set or clear an account data entry',
    color: '#7c3aed',
    icon: '⚙',
  },
  manage_sell_offer: {
    label: 'Sell Offer',
    description: 'Create a DEX sell offer',
    color: '#d97706',
    icon: '⇄',
  },
  create_group: {
    label: 'Create Group',
    description: 'Create a new savings group on the contract',
    color: '#059669',
    icon: '+',
  },
  join_group: {
    label: 'Join Group',
    description: 'Join an existing savings group',
    color: '#0284c7',
    icon: '⊞',
  },
  contribute: {
    label: 'Contribute',
    description: 'Contribute to a group cycle',
    color: '#0891b2',
    icon: '⊕',
  },
  execute_payout: {
    label: 'Execute Payout',
    description: 'Trigger a payout for the current cycle',
    color: '#dc2626',
    icon: '♺',
  },
};
