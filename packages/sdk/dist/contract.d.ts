/**
 * Contract function names, kept in sync with contracts/stellar-save/src/lib.rs.
 *
 * @internal Not part of the public API (not re-exported from index.ts). Kept
 * only so `pnpm check:abi` (src/abi-drift.test.ts) can detect ABI drift.
 */
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
    readonly ACTIVATE_GROUP: "activate_group";
    readonly GET_NEXT_RECIPIENT: "get_next_recipient";
    readonly GET_GROUP_BALANCE: "get_group_balance";
};
//# sourceMappingURL=contract.d.ts.map