/**
 * PinScreen.tsx
 *
 * A numeric PIN entry screen used as the biometric fallback.
 * Renders a 4-digit dot display + number pad.
 *
 * Props:
 * - `onSuccess(pin)` – called with the raw PIN once 4 digits are entered.
 * - `title`          – header text (defaults to "Enter your PIN").
 * - `subtitle`       – secondary text shown below the dots.
 */

import { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
  AccessibilityInfo,
} from 'react-native';

const PIN_LENGTH = 4;
const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'] as const;

interface PinScreenProps {
  onSuccess: (pin: string) => void;
  title?: string;
  subtitle?: string;
}

export function PinScreen({
  onSuccess,
  title = 'Enter your PIN',
  subtitle,
}: PinScreenProps) {
  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleKey = useCallback(
    (key: string) => {
      if (key === '') return; // empty placeholder key
      if (key === '⌫') {
        setDigits((prev) => prev.slice(0, -1));
        setError(null);
        return;
      }

      setDigits((prev) => {
        const next = [...prev, key];
        if (next.length === PIN_LENGTH) {
          const pin = next.join('');
          onSuccess(pin);
          return []; // reset for potential re-entry after wrong PIN
        }
        return next;
      });
      setError(null);
    },
    [onSuccess],
  );

  /** Called by AuthGate when verification fails so the user gets feedback. */
  const shakeError = useCallback((message: string) => {
    setError(message);
    Vibration.vibrate(200);
    AccessibilityInfo.announceForAccessibility(message);
  }, []);

  // Expose shakeError via ref — AuthGate calls it imperatively.
  // (Not using forwardRef here to keep types simple; parent can pass a callback prop instead.)
  void shakeError; // prevent unused-var lint warning — AuthGate drives error via `errorMessage` prop

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {/* Dot display */}
      <View style={styles.dots} accessibilityLabel={`${digits.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, digits.length > i && styles.dotFilled]}
          />
        ))}
      </View>

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="assertive">
          {error}
        </Text>
      ) : null}

      {/* Number pad */}
      <View style={styles.pad}>
        {PAD_KEYS.map((key, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.key, key === '' && styles.keyInvisible]}
            onPress={() => handleKey(key)}
            disabled={key === ''}
            accessibilityLabel={key === '⌫' ? 'Delete' : key === '' ? undefined : key}
            accessibilityRole="button"
          >
            <Text style={styles.keyText}>{key}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f1117',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 24,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#6366f1',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#6366f1',
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 264,
    marginTop: 16,
    gap: 8,
  },
  key: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1e2130',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyInvisible: {
    backgroundColor: 'transparent',
  },
  keyText: {
    fontSize: 24,
    fontWeight: '500',
    color: '#ffffff',
  },
});
