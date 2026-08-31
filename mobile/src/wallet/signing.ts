import * as Linking from 'expo-linking';
import { Keypair, TransactionBuilder } from 'stellar-sdk';

export type SigningStatus = 'idle' | 'pending' | 'success' | 'failure';

export interface SigningResult {
  status: SigningStatus;
  signedXdr?: string;
  error?: string;
}

/** Signs a transaction locally using the in-app keypair. Mirrors the web Freighter flow's signTransaction shape. */
export function signWithLocalKeypair(
  xdr: string,
  secretKey: string,
  networkPassphrase: string
): string {
  const transaction = TransactionBuilder.fromXDR(xdr, networkPassphrase);
  transaction.sign(Keypair.fromSecret(secretKey));
  return transaction.toXDR();
}

/**
 * In-memory only — deliberately not persisted. If the app is killed mid
 * signature, there is nothing on disk to resume, so a fresh launch always
 * starts from `idle` rather than a stuck "pending" state.
 */
let pendingSession: { resolve: (result: SigningResult) => void } | null = null;

/**
 * Hands a transaction off to an external Stellar-URI-capable wallet (SEP-7)
 * and resolves once that wallet calls back with the signed XDR (or the user
 * cancels). `callbackUrl` must be this app's registered deep-link scheme.
 */
export function requestExternalSignature(
  xdr: string,
  callbackUrl: string
): Promise<SigningResult> {
  if (pendingSession) {
    return Promise.resolve({ status: 'failure', error: 'A signature request is already pending.' });
  }

  const signUri = `stellar:tx?xdr=${encodeURIComponent(xdr)}&callback=${encodeURIComponent(callbackUrl)}`;

  return new Promise((resolve) => {
    pendingSession = { resolve };
    Linking.openURL(signUri).catch((error) => {
      pendingSession = null;
      resolve({ status: 'failure', error: error instanceof Error ? error.message : String(error) });
    });
  });
}

/** Call from the app's deep-link handler (App.tsx Linking listener) when the external wallet calls back. */
export function handleSigningCallback(url: string): void {
  if (!pendingSession) return;

  const { resolve } = pendingSession;
  pendingSession = null;

  const params = Linking.parse(url).queryParams ?? {};
  const signedXdr = typeof params.signed_xdr === 'string' ? params.signed_xdr : undefined;

  if (signedXdr) {
    resolve({ status: 'success', signedXdr });
  } else {
    resolve({ status: 'failure', error: 'External wallet did not return a signed transaction.' });
  }
}

/** Cancels a pending external signature request, leaving no orphaned state. */
export function cancelExternalSignature(): void {
  if (!pendingSession) return;
  const { resolve } = pendingSession;
  pendingSession = null;
  resolve({ status: 'failure', error: 'Cancelled by user.' });
}
