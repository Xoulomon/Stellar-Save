/**
 * biometricAuth.ts
 *
 * Wraps expo-local-authentication to provide biometric (Face ID / fingerprint)
 * and PIN-fallback authentication for app-unlock and transaction-signing gates.
 *
 * Design:
 * - `checkBiometricSupport` is cheap and safe to call at startup.
 * - `authenticate` always falls back to device PIN/passcode if biometrics fail
 *   or are not enrolled — no user is ever locked out.
 * - The idle-timeout logic is handled by `AuthGate` (not here), keeping this
 *   module purely concerned with the prompt itself.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const PIN_STORAGE_KEY = 'stellar_save_pin';

// ─── Biometric support ────────────────────────────────────────────────────────

export interface BiometricSupport {
  isAvailable: boolean;
  isEnrolled: boolean;
  /** e.g. ["FACIAL_RECOGNITION", "FINGERPRINT"] */
  types: LocalAuthentication.AuthenticationType[];
}

export async function checkBiometricSupport(): Promise<BiometricSupport> {
  const isAvailable = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = isAvailable && (await LocalAuthentication.isEnrolledAsync());
  const types = isAvailable ? await LocalAuthentication.supportedAuthenticationTypesAsync() : [];
  return { isAvailable, isEnrolled, types };
}

// ─── Biometric prompt ─────────────────────────────────────────────────────────

export interface AuthResult {
  success: boolean;
  /** 'biometric' | 'pin' | null when not yet attempted */
  method: 'biometric' | 'pin' | null;
  error?: string;
}

/**
 * Attempts biometric authentication; returns success/failure.
 * Does NOT fall back to PIN — callers should call `authenticateWithPin` on
 * failure if they want the PIN path.
 */
export async function authenticateWithBiometric(
  promptMessage = 'Confirm your identity to continue',
): Promise<AuthResult> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use PIN',
      disableDeviceFallback: true,
    });
    return {
      success: result.success,
      method: 'biometric',
      error: result.success ? undefined : (result as { error?: string }).error,
    };
  } catch (err) {
    return {
      success: false,
      method: 'biometric',
      error: err instanceof Error ? err.message : 'Biometric authentication failed',
    };
  }
}

// ─── PIN management ───────────────────────────────────────────────────────────

/** Persists a PIN hash to SecureStore. Call during onboarding. */
export async function savePin(pin: string): Promise<void> {
  // Simple hash — expo-secure-store is encrypted at rest; no extra hashing needed
  // for this use-case, but we store a fixed-length digest to avoid leaking length.
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(PIN_STORAGE_KEY, hashHex, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
}

export async function hasPin(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(PIN_STORAGE_KEY);
  return stored !== null;
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_STORAGE_KEY);
}

/**
 * Verifies the supplied PIN against the stored hash.
 * Returns an `AuthResult` so callers treat it the same as the biometric path.
 */
export async function authenticateWithPin(pin: string): Promise<AuthResult> {
  const stored = await SecureStore.getItemAsync(PIN_STORAGE_KEY);
  if (!stored) {
    return { success: false, method: 'pin', error: 'No PIN has been set up.' };
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const candidate = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return {
    success: candidate === stored,
    method: 'pin',
    error: candidate === stored ? undefined : 'Incorrect PIN. Please try again.',
  };
}

// ─── Unified authenticate ─────────────────────────────────────────────────────

/**
 * Tries biometrics first (if available and enrolled), then falls back to PIN.
 * This is the primary entry-point for both app-unlock and signing gates.
 *
 * @param promptMessage  Shown in the system biometric dialog.
 * @param pinFallback    Called when PIN is needed; must return the entered PIN.
 */
export async function authenticate(
  promptMessage: string,
  pinFallback: () => Promise<string>,
): Promise<AuthResult> {
  const support = await checkBiometricSupport();

  if (support.isAvailable && support.isEnrolled) {
    const result = await authenticateWithBiometric(promptMessage);
    if (result.success) return result;
    // Biometric failed — fall through to PIN
  }

  const pin = await pinFallback();
  return authenticateWithPin(pin);
}
