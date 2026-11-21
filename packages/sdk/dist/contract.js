/**
 * Contract function names, kept in sync with contracts/stellar-save/src/lib.rs.
 *
 * @internal Not part of the public API (not re-exported from index.ts). Kept
 * only so `pnpm check:abi` (src/abi-drift.test.ts) can detect ABI drift.
 */
export const CONTRACT_FUNCTIONS = {
    CREATE_GROUP: 'create_group',
    GET_GROUP: 'get_group',
    JOIN_GROUP: 'join_group',
    CONTRIBUTE: 'contribute',
    EXECUTE_PAYOUT: 'execute_payout',
    LIST_MEMBERS: 'list_members',
    IS_MEMBER: 'is_member',
    GET_CONTRIBUTION_STATUS: 'get_contribution_status',
    IS_COMPLETE: 'is_complete',
    PAUSE_GROUP: 'pause_group',
    UNPAUSE_GROUP: 'unpause_group',
    ACTIVATE_GROUP: 'activate_group',
    GET_NEXT_RECIPIENT: 'get_next_recipient',
    GET_GROUP_BALANCE: 'get_group_balance',
};
