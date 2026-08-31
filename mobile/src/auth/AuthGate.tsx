/**
 * AuthGate.tsx
 *
 * Wraps the app and blocks navigation until the user authenticates.
 *
 * Behaviour:
 * - On foreground after IDLE_TIMEOUT_MS the gate re-locks.
 * - Biometric prompt fires automatically on mount (and on every re-lock).
 * - Falls back to PinScreen when biometrics fail or are unavailable.
 * - Provides `requireAuth(promptMessage)` context so any screen can trigger
 *   a signing-confirmation gate before submitting a transaction.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  checkBiometricSupport,
  authenticateWithBiometric,
  authenticateWithPin,
  type AuthResult,
} from './biometricAuth';
import { PinScreen } from './PinScreen';

// ─── Idle timeout (configurable) ─────────────────────────────────────────────

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ─── Context ──────────────────────────────────────────────────────────────────

interface AuthContextValue {
  /**
   * Call before any signing operation.  Shows the biometric / PIN prompt and
   * resolves with `true` if the user passes, `false` if they cancel or fail.
   */
  requireAuth: (promptMessage?: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue>({
  requireAuth: async () => false,
});

export function useAuthGate(): AuthContextValue {
  return useContext(AuthContext);
}

// ─── Gate component ───────────────────────────────────────────────────────────

type GateState = 'checking' | 'locked' | 'unlocked' | 'pin';

interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const [gateState, setGateState] = useState<GateState>('checking');
  const [pinError, setPinError] = useState<string | null>(null);
  // Stores the resolve callback for in-flight `requireAuth` calls
  const pendingResolveRef = useRef<((ok: boolean) => void) | null>(null);
  const lastActiveRef = useRef<number>(Date.now());
  const backgroundTimeRef = useRef<number | null>(null);

  // ── Biometric helpers ──────────────────────────────────────────────────────

  const attemptBiometric = useCallback(async (promptMessage?: string): Promise<boolean> => {
    const support = await checkBiometricSupport();
    if (!support.isAvailable || !support.isEnrolled) return false;

    const result = await authenticateWithBiometric(
      promptMessage ?? 'Unlock Stellar Save',
    );
    return result.success;
  }, []);

  // ── Initial unlock on mount ────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const ok = await attemptBiometric();
      if (ok) {
        setGateState('unlocked');
      } else {
        // No biometrics or they failed → show PIN entry
        setGateState('pin');
      }
    }
    void init();
  }, [attemptBiometric]);

  // ── Re-lock on idle / background ──────────────────────────────────────────

  useEffect(() => {
    function handleAppStateChange(nextState: AppStateStatus) {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundTimeRef.current = Date.now();
      } else if (nextState === 'active') {
        const bgTime = backgroundTimeRef.current;
        if (bgTime !== null && Date.now() - bgTime >= IDLE_TIMEOUT_MS) {
          // Been away long enough — re-lock
          setPinError(null);
          setGateState('checking');
          void attemptBiometric().then((ok) => {
            setGateState(ok ? 'unlocked' : 'pin');
          });
        }
        backgroundTimeRef.current = null;
        lastActiveRef.current = Date.now();
      }
    }

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [attemptBiometric]);

  // ── PIN entry handler (used for both unlock and `requireAuth`) ─────────────

  const handlePin = useCallback(async (pin: string) => {
    const result: AuthResult = await authenticateWithPin(pin);
    if (result.success) {
      setPinError(null);
      if (pendingResolveRef.current) {
        pendingResolveRef.current(true);
        pendingResolveRef.current = null;
        setGateState('unlocked');
      } else {
        setGateState('unlocked');
      }
    } else {
      setPinError(result.error ?? 'Incorrect PIN');
    }
  }, []);

  // ── requireAuth (for signing gates) ───────────────────────────────────────

  const requireAuth = useCallback(
    async (promptMessage?: string): Promise<boolean> => {
      // Try biometric first
      const ok = await attemptBiometric(promptMessage ?? 'Confirm transaction');
      if (ok) return true;

      // Fall back to PIN — show the PIN screen and wait for resolution
      return new Promise<boolean>((resolve) => {
        pendingResolveRef.current = resolve;
        setGateState('pin');
      });
    },
    [attemptBiometric],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  if (gateState === 'checking') return null; // Brief splash before biometric fires

  if (gateState === 'locked' || gateState === 'pin') {
    return (
      <PinScreen
        onSuccess={handlePin}
        title="Enter PIN"
        subtitle={
          pinError ??
          'Biometric authentication unavailable. Enter your PIN to continue.'
        }
      />
    );
  }

  return (
    <AuthContext.Provider value={{ requireAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
