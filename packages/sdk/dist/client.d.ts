/**
 * Typed REST API client for the Stellar-Save backend.
 * Works in both browser (fetch) and Node.js environments.
 */
import type { Group, GroupFilters, Contribution, Payout, CostReport, PaginatedResponse } from './types';
export interface ApiClientConfig {
    baseUrl: string;
    /** Admin secret for protected endpoints (server-side only). */
    adminSecret?: string;
    /** JWT bearer token for authenticated user endpoints. */
    authToken?: string;
}
export declare class ApiError extends Error {
    readonly status: number;
    constructor(status: number, message: string);
}
export declare class StellarSaveApiClient {
    private readonly config;
    constructor(config: ApiClientConfig);
    private request;
    listGroups(filters?: GroupFilters): Promise<PaginatedResponse<Group>>;
    getGroup(groupId: string): Promise<Group>;
    createGroup(data: Omit<Group, 'id' | 'createdAt' | 'currentMembers' | 'status'>): Promise<{
        id: string;
    }>;
    joinGroup(groupId: string): Promise<void>;
    getContributions(groupId: string, cycle?: number): Promise<Contribution[]>;
    contribute(groupId: string, amount: number): Promise<{
        txHash: string;
    }>;
    getPayouts(groupId: string): Promise<Payout[]>;
    executePayout(groupId: string): Promise<{
        txHash: string;
    }>;
    getCostReport(): Promise<CostReport>;
}
/** Create a client pre-configured from environment variables (Node.js). */
export declare function createApiClient(overrides?: Partial<ApiClientConfig>): StellarSaveApiClient;
//# sourceMappingURL=client.d.ts.map