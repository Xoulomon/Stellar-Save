/**
 * Shared domain types consumed by frontend, backend, and mobile.
 * These mirror the on-chain contract data structures and REST API shapes.
 */
export type GroupStatus = 'active' | 'completed' | 'pending';
export interface Group {
    id: string;
    name: string;
    description?: string;
    contributionAmount: number;
    cycleDuration: number;
    maxMembers: number;
    currentMembers: number;
    status: GroupStatus;
    createdAt: Date;
    creator?: string;
    isActive?: boolean;
    started?: boolean;
    startedAt?: Date | null;
    currentCycle?: number;
}
export interface GroupFilters {
    search?: string;
    status?: GroupStatus | 'all';
    minAmount?: string;
    maxAmount?: string;
    minMembers?: string;
    maxMembers?: string;
    sort?: 'date-desc' | 'date-asc' | 'amount-asc' | 'amount-desc' | 'members-desc';
}
export type MemberStatus = 'active' | 'inactive' | 'pending' | 'removed';
export interface GroupMember {
    id: string;
    address: string;
    name?: string;
    joinedAt: Date;
    totalContributions: number;
    isActive: boolean;
}
export type ContributionStatus = 'completed' | 'pending' | 'failed';
export interface Contribution {
    id: string;
    groupId: string;
    memberAddress: string;
    amount: number;
    cycleNumber: number;
    status: ContributionStatus;
    timestamp: Date;
    transactionHash?: string;
}
export type PayoutStatus = 'completed' | 'next' | 'upcoming';
export interface Payout {
    id: string;
    groupId: string;
    recipientAddress: string;
    amount: number;
    cycleNumber: number;
    status: PayoutStatus;
    executedAt?: Date;
    transactionHash?: string;
}
export type TransactionType = 'payment' | 'swap' | 'deposit' | 'withdraw' | 'claimable' | 'other';
export interface Transaction {
    id: string;
    hash: string;
    createdAt: string;
    type: TransactionType;
    amount: string;
    assetCode: string;
    assetIssuer?: string;
    from: string;
    to?: string;
    memo?: string;
    status: 'success' | 'pending' | 'failed';
    fee: string;
}
export interface ServiceCost {
    service: string;
    amount: number;
    unit: string;
}
export interface OptimizationRecommendation {
    resourceId: string;
    resourceType: string;
    finding: string;
    estimatedMonthlySavings: number;
    currentInstanceType?: string;
    recommendedInstanceType?: string;
    reason: string;
}
export interface CostReport {
    generatedAt: Date;
    last30DaysByService: ServiceCost[];
    forecastCurrentMonth: number;
    recommendations: OptimizationRecommendation[];
    totalEstimatedSavings: number;
}
export interface PaginationMeta {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}
export interface PaginatedResponse<T> {
    data: T[];
    pagination: PaginationMeta;
}
//# sourceMappingURL=types.d.ts.map