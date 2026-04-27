/**
 * contractClient.ts
 *
 * Low-level Soroban contract client for StellarSave.
 * Handles XDR encoding/decoding, transaction building, signing via Freighter,
 * and submission to the RPC node.
 */

import {
  Contract,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  xdr,
  Address,
} from '@stellar/stellar-sdk';
import * as freighterApi from '@stellar/freighter-api';

// ─── Config ──────────────────────────────────────────────────────────────────

const RPC_URL: string =
  (import.meta.env['VITE_STELLAR_RPC_URL'] as string | undefined) ??
  'https://soroban-testnet.stellar.org';

const NETWORK_PASSPHRASE: string =
  (import.meta.env['VITE_STELLAR_NETWORK'] as string | undefined) === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;

export const CONTRACT_ID: string =
  (import.meta.env['VITE_STELLAR_SAVE_CONTRACT_ID'] as string | undefined) ?? '';

// Soroban RPC server instance (singleton)
export const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });

// ─── Error Handling ───────────────────────────────────────────────────────────

/**
 * Maps Soroban contract error codes to human-readable messages.
* Mirrors the StellarSaveError enum in error.rs.
 */
export const CONTRACT_ERROR_MESSAGES: Record<number, string> = {  1002: 'Group is full.',
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
};

export class ContractError extends Error {
  public readonly code: number | null;

  constructor(code: number | null, message: string) {
    super(message);
    this.name = 'ContractError';
    this.code = code;
  }
}

/**
 * Parses a raw Soroban error into a ContractError with a friendly message.
 */
export function parseContractError(err: unknown): ContractError {
  if (err instanceof ContractError) return err;

  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;

    const errorStr =
      typeof e['error'] === 'string'
        ? e['error']
        : typeof e['message'] === 'string'
          ? e['message']
          : null;

    if (errorStr) {
      const match = errorStr.match(/Error\(Contract, #(\d+)\)/);
      if (match) {
        const code = parseInt(match[1], 10);
        return new ContractError(
          code,
          CONTRACT_ERROR_MESSAGES[code] ?? `Contract error #${code}`,
        );
      }
      return new ContractError(null, errorStr);
    }
  }

  if (err instanceof Error) {
    return new ContractError(null, err.message);
  }

  return new ContractError(null, 'An unknown error occurred.');
}

// ─── Transaction Helpers ──────────────────────────────────────────────────────

/**
 * Signs and submits a Soroban transaction via Freighter.
 * Returns the transaction hash on success.
 */
async function signAndSubmit(
  sourceAddress: string,
  operation: xdr.Operation,
): Promise<string> {
  if (!CONTRACT_ID) {
    throw new ContractError(
      null,
      'Contract ID is not configured. Set VITE_STELLAR_SAVE_CONTRACT_ID in your .env file.',
    );
  }

  // 1. Fetch source account
  const account = await server.getAccount(sourceAddress);

  // 2. Build transaction
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  // 3. Simulate to get the footprint / resource fees
  const simResult = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw parseContractError(simResult);
  }

  if (!SorobanRpc.Api.isSimulationSuccess(simResult)) {
    throw new ContractError(null, 'Transaction simulation failed.');
  }

  // 4. Assemble the transaction with the simulation result
  const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();

  // 5. Sign with Freighter
  const freighter = freighterApi as unknown as Record<string, unknown>;
  const signFn = freighter['signTransaction'] as
    | ((xdr: string, opts: { networkPassphrase: string }) => Promise<unknown>)
    | undefined;

  if (!signFn) {
    throw new ContractError(null, 'Freighter signTransaction is not available.');
  }

  const signResult = await signFn(preparedTx.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  // Handle both old and new Freighter API shapes
  let signedXdr: string;
  if (typeof signResult === 'string') {
    signedXdr = signResult;
  } else if (
    signResult &&
    typeof signResult === 'object' &&
    'signedTxXdr' in (signResult as object)
  ) {
    signedXdr = (signResult as { signedTxXdr: string }).signedTxXdr;
  } else {
    throw new ContractError(null, 'Unexpected response from Freighter.');
  }

  // 6. Submit
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const sendResult = await server.sendTransaction(signedTx);

  if (sendResult.status === 'ERROR') {
    throw parseContractError({
      error: sendResult.errorResult?.toXDR() ?? 'Submission failed.',
    });
  }

  // 7. Poll for confirmation (up to ~30 s)
  const hash = sendResult.hash;
  let getResult = await server.getTransaction(hash);

  for (
    let i = 0;
    i < 20 && getResult.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND;
    i++
  ) {
    await new Promise<void>((r) => setTimeout(r, 1500));
    getResult = await server.getTransaction(hash);
  }

  if (getResult.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
    throw new ContractError(null, 'Transaction failed on-chain.');
  }

  if (getResult.status !== SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
    throw new ContractError(null, 'Transaction did not confirm in time.');
  }

  return hash;
}

/**
 * Simulates a read-only contract call and returns the decoded result.
 * Uses a dummy account so no wallet is required.
 */
async function simulateRead<T>(operation: xdr.Operation): Promise<T> {
  if (!CONTRACT_ID) {
    throw new ContractError(
      null,
      'Contract ID is not configured. Set VITE_STELLAR_SAVE_CONTRACT_ID in your .env file.',
    );
  }

  // Dummy account for read-only simulations
  const DUMMY_ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
  const account = await server.getAccount(DUMMY_ADDRESS).catch(() => ({
    accountId: () => DUMMY_ADDRESS,
    sequenceNumber: () => '0',
    incrementSequenceNumber: () => undefined,
  }));

  const tx = new TransactionBuilder(
    account as Parameters<typeof TransactionBuilder>[0],
    {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    },
  )
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw parseContractError(simResult);
  }

  if (!SorobanRpc.Api.isSimulationSuccess(simResult) || !simResult.result) {
    throw new ContractError(null, 'Simulation returned no result.');
  }

  return scValToNative(simResult.result.retval) as T;
}

// ─── Contract Instance ────────────────────────────────────────────────────────

function getContract(): Contract {
  if (!CONTRACT_ID) {
    throw new ContractError(null, 'Contract ID is not configured.');
  }
  return new Contract(CONTRACT_ID);
}

// ─── Public Contract Methods ──────────────────────────────────────────────────

export interface CreateGroupParams {
  creator: string;
  contributionAmount: bigint; // stroops
  cycleDuration: bigint;      // seconds
  maxMembers: number;
}

/** create_group → signs and submits, returns the new group ID */
export async function createGroup(params: CreateGroupParams): Promise<bigint> {
  const contract = getContract();
  const op = contract.call(
    'create_group',
    new Address(params.creator).toScVal(),
    nativeToScVal(params.contributionAmount, { type: 'i128' }),
    nativeToScVal(params.cycleDuration, { type: 'u64' }),
    nativeToScVal(params.maxMembers, { type: 'u32' }),
  );
  await signAndSubmit(params.creator, op);
  // Return the latest group ID from the counter after creation
  return getTotalGroups();
}

/** get_group → returns the raw Group struct as a plain object */
export async function getGroup(groupId: bigint): Promise<Record<string, unknown>> {
  const contract = getContract();
  const op = contract.call('get_group', nativeToScVal(groupId, { type: 'u64' }));
  return simulateRead<Record<string, unknown>>(op);
}

/** list_groups → returns an array of Group objects */
export async function listGroups(
  cursor: bigint,
  limit: number,
  statusFilter?: string,
): Promise<Record<string, unknown>[]> {
  const contract = getContract();
  const statusArg = statusFilter
    ? nativeToScVal({ tag: statusFilter, values: [] }, { type: 'map' })
    : xdr.ScVal.scvVoid();
  const op = contract.call(
    'list_groups',
    nativeToScVal(cursor, { type: 'u64' }),
    nativeToScVal(limit, { type: 'u32' }),
    statusArg,
  );
  return simulateRead<Record<string, unknown>[]>(op);
}

/** get_total_groups_created → returns the total group count */
export async function getTotalGroups(): Promise<bigint> {
  const contract = getContract();
  const op = contract.call('get_total_groups_created');
  return simulateRead<bigint>(op);
}

export interface JoinGroupParams {
  groupId: bigint;
  member: string;
}

/** join_group → signs and submits, returns tx hash */
export async function joinGroup(params: JoinGroupParams): Promise<string> {
  const contract = getContract();
  const op = contract.call(
    'join_group',
    nativeToScVal(params.groupId, { type: 'u64' }),
    new Address(params.member).toScVal(),
  );
  return signAndSubmit(params.member, op);
}

export interface ContributeParams {
  groupId: bigint;
  member: string;
  amount: bigint; // stroops
}

/** contribute → signs and submits, returns tx hash */
export async function contribute(params: ContributeParams): Promise<string> {
  const contract = getContract();
  const op = contract.call(
    'contribute',
    nativeToScVal(params.groupId, { type: 'u64' }),
    new Address(params.member).toScVal(),
    nativeToScVal(params.amount, { type: 'i128' }),
  );
  return signAndSubmit(params.member, op);
}

export interface ActivateGroupParams {
  groupId: bigint;
  creator: string;
}

/** activate_group → signs and submits, returns tx hash */
export async function activateGroup(params: ActivateGroupParams): Promise<string> {
  const contract = getContract();
  const op = contract.call(
    'activate_group',
    nativeToScVal(params.groupId, { type: 'u64' }),
    new Address(params.creator).toScVal(),
  );
  return signAndSubmit(params.creator, op);
}

export interface ExecutePayoutParams {
  groupId: bigint;
  recipient: string;
}

/** execute_payout → signs and submits, returns tx hash */
export async function executePayout(params: ExecutePayoutParams): Promise<string> {
  const contract = getContract();
  const op = contract.call(
    'execute_payout',
    nativeToScVal(params.groupId, { type: 'u64' }),
    new Address(params.recipient).toScVal(),
  );
  return signAndSubmit(params.recipient, op);
}

/** is_payout_due → read-only check */
export async function isPayoutDue(groupId: bigint): Promise<boolean> {
  const contract = getContract();
  const op = contract.call('is_payout_due', nativeToScVal(groupId, { type: 'u64' }));
  return simulateRead<boolean>(op);
}

/** get_member_count → read-only */
export async function getMemberCount(groupId: bigint): Promise<number> {
  const contract = getContract();
  const op = contract.call('get_member_count', nativeToScVal(groupId, { type: 'u64' }));
  return simulateRead<number>(op);
}

/** get_payout_position → read-only */
export async function getPayoutPosition(
  groupId: bigint,
  memberAddress: string,
): Promise<number> {
  const contract = getContract();
  const op = contract.call(
    'get_payout_position',
    nativeToScVal(groupId, { type: 'u64' }),
    new Address(memberAddress).toScVal(),
  );
  return simulateRead<number>(op);
}

/** has_received_payout → read-only */
export async function hasReceivedPayout(
  groupId: bigint,
  memberAddress: string,
): Promise<boolean> {
  const contract = getContract();
  const op = contract.call(
    'has_received_payout',
    nativeToScVal(groupId, { type: 'u64' }),
    new Address(memberAddress).toScVal(),
  );
  return simulateRead<boolean>(op);
}

/** get_member_total_contributions → read-only */
export async function getMemberTotalContributions(
  groupId: bigint,
  memberAddress: string,
): Promise<bigint> {
  const contract = getContract();
  const op = contract.call(
    'get_member_total_contributions',
    nativeToScVal(groupId, { type: 'u64' }),
    new Address(memberAddress).toScVal(),
  );
  return simulateRead<bigint>(op);
}

/** get_group_balance → read-only */
export async function getGroupBalance(groupId: bigint): Promise<bigint> {
  const contract = getContract();
  const op = contract.call('get_group_balance', nativeToScVal(groupId, { type: 'u64' }));
  return simulateRead<bigint>(op);
}

export interface PayoutScheduleEntry {
  recipient: string;
  cycle: number;
  payout_date: bigint;
}

/** get_payout_schedule → read-only */
export async function getPayoutSchedule(
  groupId: bigint,
): Promise<PayoutScheduleEntry[]> {
  const contract = getContract();
  const op = contract.call('get_payout_schedule', nativeToScVal(groupId, { type: 'u64' }));
  return simulateRead<PayoutScheduleEntry[]>(op);
}

/** get_contribution_deadline → read-only */
export async function getContributionDeadline(
  groupId: bigint,
  cycleNumber: number,
): Promise<bigint> {
  const contract = getContract();
  const op = contract.call(
    'get_contribution_deadline',
    nativeToScVal(groupId, { type: 'u64' }),
    nativeToScVal(cycleNumber, { type: 'u32' }),
  );
  return simulateRead<bigint>(op);
}

/** is_cycle_complete → read-only */
export async function isCycleComplete(
  groupId: bigint,
  cycleNumber: number,
): Promise<boolean> {
  const contract = getContract();
  const op = contract.call(
    'is_cycle_complete',
    nativeToScVal(groupId, { type: 'u64' }),
    nativeToScVal(cycleNumber, { type: 'u32' }),
  );
  return simulateRead<boolean>(op);
}

export interface PauseGroupParams {
  groupId: bigint;
  caller: string;
}

/** pause_group → signs and submits, returns tx hash */
export async function pauseGroup(params: PauseGroupParams): Promise<string> {
  const contract = getContract();
  const op = contract.call(
    'pause_group',
    nativeToScVal(params.groupId, { type: 'u64' }),
    new Address(params.caller).toScVal(),
  );
  return signAndSubmit(params.caller, op);
}

/** resume_group → signs and submits, returns tx hash */
export async function resumeGroup(params: PauseGroupParams): Promise<string> {
  const contract = getContract();
  const op = contract.call(
    'resume_group',
    nativeToScVal(params.groupId, { type: 'u64' }),
    new Address(params.caller).toScVal(),
  );
  return signAndSubmit(params.caller, op);
}
