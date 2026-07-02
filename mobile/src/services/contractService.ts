/**
 * contractService.ts
 *
 * Mobile contract service — mirrors the frontend lib/client pattern but
 * uses the local keypair (expo-secure-store) for signing instead of Freighter.
 *
 * All RPC calls hit the Stellar Soroban testnet by default.
 * Set EXPO_PUBLIC_STELLAR_RPC_URL / EXPO_PUBLIC_CONTRACT_ID in app.config.js
 * to override for mainnet.
 */

import {
  Horizon,
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  Keypair,
  xdr,
} from '@stellar/stellar-sdk';
import { loadSecretKey } from '../wallet/secureStore';

// ─── Config ───────────────────────────────────────────────────────────────────

const RPC_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_STELLAR_RPC_URL) ||
  'https://horizon-testnet.stellar.org';

const CONTRACT_ID =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_CONTRACT_ID) || '';

const NETWORK_PASSPHRASE = Networks.TESTNET;

export const horizon = new Horizon.Server(RPC_URL);

// ─── Errors ───────────────────────────────────────────────────────────────────

/** Maps raw Soroban error codes to user-friendly messages. */
const CONTRACT_ERROR_MAP: Record<string, string> = {
  GroupFull: 'This group is already full.',
  InvalidState: 'This action is not allowed in the group's current state.',
  AlreadyMember: 'You are already a member of this group.',
  NotMember: 'You are not a member of this group.',
  InsufficientBalance: 'Insufficient XLM balance to complete this action.',
  Unauthorized: 'You are not authorised to perform this action.',
  GroupNotFound: 'Group not found.',
  ContributionAlreadyMade: 'You have already contributed this cycle.',
};

export class ContractError extends Error {
  readonly code: string | null;
  readonly userMessage: string;

  constructor(code: string | null, message: string) {
    super(message);
    this.code = code;
    this.userMessage = (code && CONTRACT_ERROR_MAP[code]) ?? message;
  }
}

export function parseContractError(raw: unknown): ContractError {
  if (raw instanceof ContractError) return raw;
  const msg = raw instanceof Error ? raw.message : String(raw);
  // Try to extract error variant from Soroban diagnostic event message
  for (const code of Object.keys(CONTRACT_ERROR_MAP)) {
    if (msg.includes(code)) return new ContractError(code, msg);
  }
  return new ContractError(null, msg);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Group {
  id: string;
  name?: string;
  contributionAmount: number; // in stroops
  cycleDuration: number;      // seconds
  maxMembers: number;
  memberCount: number;
  status: 'pending' | 'active' | 'completed' | 'paused';
  creator: string;
  createdAt: Date;
}

export interface CreateGroupParams {
  contributionAmount: bigint; // stroops
  cycleDuration: bigint;      // seconds
  maxMembers: number;
}

export interface JoinGroupParams {
  groupId: bigint;
}

// ─── Signing helper ───────────────────────────────────────────────────────────

async function getKeypair(): Promise<Keypair> {
  const secret = await loadSecretKey();
  if (!secret) throw new ContractError(null, 'No wallet found. Please set up your wallet first.');
  return Keypair.fromSecret(secret);
}

/**
 * Build, sign, and submit a fee-bump-free transaction via Horizon.
 * For Soroban contract calls we'd normally use SorobanClient — this helper
 * uses the Horizon operations layer which covers simple native XLM transfers
 * and provides the signing skeleton for contract invocations.
 */
async function signAndSubmit(
  operations: xdr.Operation[],
  signerKeypair: Keypair,
): Promise<string> {
  const account = await horizon.loadAccount(signerKeypair.publicKey());
  let builder = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  }).setTimeout(30);

  for (const op of operations) {
    builder = builder.addOperation(op);
  }

  const tx = builder.build();
  tx.sign(signerKeypair);
  const result = await horizon.submitTransaction(tx);
  return result.hash;
}

// ─── Contract service ─────────────────────────────────────────────────────────

/**
 * Read the on-chain group list.
 *
 * NOTE: Until the Soroban contract is deployed and the SDK client is wired up,
 * this hits the Horizon API for account/asset data.  The full contract
 * invocation layer (via SorobanRPC) is scaffolded below and enabled once
 * CONTRACT_ID is set.
 */
export async function listGroups(): Promise<Group[]> {
  if (!CONTRACT_ID) {
    // Return an empty list when no contract is configured (test / CI environments).
    return [];
  }
  // TODO: replace with SorobanRPC contract.call('list_groups') once deployed
  throw new ContractError(null, 'listGroups requires a configured CONTRACT_ID');
}

export async function getGroup(groupId: string): Promise<Group | null> {
  if (!CONTRACT_ID) return null;
  // TODO: replace with SorobanRPC contract.call('get_group', groupId)
  throw new ContractError(null, 'getGroup requires a configured CONTRACT_ID');
}

/** Create a new savings group on-chain. Returns the new group ID. */
export async function createGroup(params: CreateGroupParams): Promise<string> {
  try {
    const kp = await getKeypair();
    // Build a manage-data operation as a placeholder for the Soroban invoke.
    // Replace with: SorobanRPC contract.call('create_group', params) once deployed.
    const op = Operation.manageData({
      name: 'create_group',
      value: Buffer.from(
        JSON.stringify({
          contribution_amount: params.contributionAmount.toString(),
          cycle_duration: params.cycleDuration.toString(),
          max_members: params.maxMembers,
        }),
      ),
    });
    return await signAndSubmit([op], kp);
  } catch (err) {
    throw parseContractError(err);
  }
}

/** Join an existing savings group. */
export async function joinGroup(params: JoinGroupParams): Promise<string> {
  try {
    const kp = await getKeypair();
    const op = Operation.manageData({
      name: 'join_group',
      value: Buffer.from(params.groupId.toString()),
    });
    return await signAndSubmit([op], kp);
  } catch (err) {
    throw parseContractError(err);
  }
}

/** Fetch the native XLM balance for a public key from Horizon. */
export async function getXlmBalance(publicKey: string): Promise<string> {
  try {
    const account = await horizon.loadAccount(publicKey);
    const native = account.balances.find((b) => b.asset_type === 'native');
    return native?.balance ?? '0';
  } catch (err) {
    if (err instanceof Error && err.message.includes('404')) {
      return '0'; // Unfunded account
    }
    throw err;
  }
}
