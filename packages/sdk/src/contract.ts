/**
 * Soroban contract error codes and utilities.
 * Generated from the StellarSaveError enum in contracts/stellar-save/src/errors.rs.
 * DO NOT edit manually — regenerate from the contract when adding new codes.
 */

export const CONTRACT_ERROR_MESSAGES: Readonly<Record<number, string>> = {
  1001: 'Group not found.',
  1002: 'Group is full.',
  1003: 'Invalid group state for this operation.',
  2001: 'Address is already a member of this group.',
  2002: 'Address is not a member of this group.',
  2003: 'Unauthorized: you do not have permission for this action.',
  3001: 'Invalid contribution amount.',
  3002: 'You have already contributed this cycle.',
  3003: 'Cycle is not yet complete.',
  3004: 'Contribution record not found.',
  4001: 'Payout failed.',
  4002: 'Payout has already been processed for this cycle.',
  4003: 'Invalid payout recipient.',
  9001: 'Internal contract error.',
  9002: 'Contract data corruption detected.',
  9003: 'Counter overflow.',
  9004: 'Contract is paused.',
  9005: 'Rate limit exceeded. Please wait before trying again.',
} as const;

export class ContractError extends Error {
  public readonly code: number | null;

  constructor(code: number | null, message: string) {
    super(message);
    this.name = 'ContractError';
    this.code = code;
  }
}

/** Parse a raw Soroban invocation error into a typed ContractError. */
export function parseContractError(err: unknown): ContractError {
  if (err instanceof ContractError) return err;

  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const msg =
      typeof e['error'] === 'string' ? e['error'] :
      typeof e['message'] === 'string' ? e['message'] : null;

    if (msg) {
      const match = msg.match(/Error\(Contract, #(\d+)\)/);
      if (match) {
        const code = parseInt(match[1], 10);
        return new ContractError(code, CONTRACT_ERROR_MESSAGES[code] ?? `Contract error #${code}`);
      }
      return new ContractError(null, msg);
    }
  }

  return new ContractError(null, String(err));
}

/** Contract function names, kept in sync with contracts/stellar-save/src/lib.rs. */
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
} as const;

export type ContractFunction = typeof CONTRACT_FUNCTIONS[keyof typeof CONTRACT_FUNCTIONS];
