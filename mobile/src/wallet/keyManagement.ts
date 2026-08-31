import { Keypair } from 'stellar-sdk';

import { saveSecretKey, loadSecretKey } from './secureStore';

export interface StellarWallet {
  publicKey: string;
  secretKey: string;
}

/** Generates a new keypair client-side and persists the secret key to secure storage. */
export async function createWallet(): Promise<StellarWallet> {
  const keypair = Keypair.random();
  const wallet: StellarWallet = {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
  };
  await saveSecretKey(wallet.secretKey);
  return wallet;
}

/** Imports an existing wallet from a raw secret key (Sxxxx...). */
export async function importFromSecretKey(secretKey: string): Promise<StellarWallet> {
  const keypair = Keypair.fromSecret(secretKey);
  const wallet: StellarWallet = {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
  };
  await saveSecretKey(wallet.secretKey);
  return wallet;
}

/**
 * Imports an existing wallet from a recovery phrase.
 *
 * TODO(#996 follow-up): stellar-sdk does not ship BIP-39 mnemonic support out
 * of the box. Wire in a dedicated mnemonic library (e.g. stellar-hd-wallet)
 * here and in the matching `generateRecoveryPhrase` step before this path
 * ships — tracked as a known gap in this scaffolding PR.
 */
export async function importFromRecoveryPhrase(_mnemonic: string): Promise<StellarWallet> {
  throw new Error('Recovery-phrase import not yet implemented — see TODO above.');
}

export async function getActiveWallet(): Promise<Pick<StellarWallet, 'secretKey'> | null> {
  const secretKey = await loadSecretKey();
  return secretKey ? { secretKey } : null;
}
