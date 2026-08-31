/**
 * Soroban contract error codes and utilities.
 * Generated from the StellarSaveError enum in contracts/stellar-save/src/errors.rs.
 * DO NOT edit manually — regenerate from the contract when adding new codes.
 */
export declare const CONTRACT_ERROR_MESSAGES: Readonly<Record<number, string>>;
export declare class ContractError extends Error {
    readonly code: number | null;
    constructor(code: number | null, message: string);
}
/** Parse a raw Soroban invocation error into a typed ContractError. */
export declare function parseContractError(err: unknown): ContractError;
/** Contract function names, kept in sync with contracts/stellar-save/src/lib.rs. */
export declare const CONTRACT_FUNCTIONS: {
    readonly CREATE_GROUP: "create_group";
    readonly GET_GROUP: "get_group";
    readonly JOIN_GROUP: "join_group";
    readonly CONTRIBUTE: "contribute";
    readonly EXECUTE_PAYOUT: "execute_payout";
    readonly LIST_MEMBERS: "list_members";
    readonly IS_MEMBER: "is_member";
    readonly GET_CONTRIBUTION_STATUS: "get_contribution_status";
    readonly IS_COMPLETE: "is_complete";
    readonly PAUSE_GROUP: "pause_group";
    readonly UNPAUSE_GROUP: "unpause_group";
};
export type ContractFunction = typeof CONTRACT_FUNCTIONS[keyof typeof CONTRACT_FUNCTIONS];
//# sourceMappingURL=contract.d.ts.map