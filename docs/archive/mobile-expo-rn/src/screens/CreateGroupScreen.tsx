/**
 * CreateGroupScreen.tsx
 *
 * Form for creating a new savings group on-chain.
 *
 * Validation rules match the Soroban contract constraints:
 * - contributionAmount: 1–1,000,000 XLM (stored as stroops: × 1e7)
 * - cycleDuration: 1–365 days (stored as seconds)
 * - maxMembers: 2–20
 *
 * The signing gate (useAuthGate) fires before the transaction is submitted
 * so biometric/PIN confirmation is required for every create-group action.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { createGroup, ContractError } from '../services/contractService';
import { useAuthGate } from '../auth/AuthGate';
import type { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Validation ───────────────────────────────────────────────────────────────

interface FormValues {
  contributionXlm: string; // user enters XLM; we convert to stroops before submit
  cycleDays: string;
  maxMembers: string;
}

interface FormErrors {
  contributionXlm?: string;
  cycleDays?: string;
  maxMembers?: string;
}

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  const xlm = parseFloat(values.contributionXlm);
  if (!values.contributionXlm || isNaN(xlm) || xlm <= 0) {
    errors.contributionXlm = 'Enter a contribution amount greater than 0.';
  } else if (xlm > 1_000_000) {
    errors.contributionXlm = 'Maximum contribution is 1,000,000 XLM.';
  }

  const days = parseInt(values.cycleDays, 10);
  if (!values.cycleDays || isNaN(days) || days < 1) {
    errors.cycleDays = 'Cycle duration must be at least 1 day.';
  } else if (days > 365) {
    errors.cycleDays = 'Cycle duration cannot exceed 365 days.';
  }

  const members = parseInt(values.maxMembers, 10);
  if (!values.maxMembers || isNaN(members) || members < 2) {
    errors.maxMembers = 'Groups require at least 2 members.';
  } else if (members > 20) {
    errors.maxMembers = 'Maximum group size is 20 members.';
  }

  return errors;
}

// ─── Field component ──────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  keyboardType = 'numeric',
  suffix,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  placeholder?: string;
  keyboardType?: 'numeric' | 'number-pad' | 'decimal-pad';
  suffix?: string;
}) {
  return (
    <View style={fieldStyles.wrapper}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View style={[fieldStyles.inputRow, !!error && fieldStyles.inputError]}>
        <TextInput
          style={fieldStyles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#4b5563"
          keyboardType={keyboardType}
          accessibilityLabel={label}
          accessibilityHint={error}
        />
        {suffix ? <Text style={fieldStyles.suffix}>{suffix}</Text> : null}
      </View>
      {error ? (
        <Text style={fieldStyles.errorText} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { fontSize: 13, color: '#9ca3af', marginBottom: 6, fontWeight: '500' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e2130',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2d3348',
    paddingHorizontal: 14,
  },
  inputError: { borderColor: '#ef4444' },
  input: { flex: 1, color: '#f9fafb', fontSize: 16, paddingVertical: 14 },
  suffix: { color: '#6b7280', fontSize: 14, marginLeft: 8 },
  errorText: { fontSize: 12, color: '#ef4444', marginTop: 4 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export function CreateGroupScreen() {
  const nav = useNavigation<Nav>();
  const { requireAuth } = useAuthGate();
  const queryClient = useQueryClient();

  const [values, setValues] = useState<FormValues>({
    contributionXlm: '',
    cycleDays: '',
    maxMembers: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function setField(key: keyof FormValues) {
    return (val: string) => setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit() {
    // Client-side validation first
    const errs = validate(values);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});

    // Require biometric/PIN before submitting
    const authed = await requireAuth('Confirm group creation');
    if (!authed) return;

    setSubmitting(true);
    try {
      const contributionAmount = BigInt(Math.round(parseFloat(values.contributionXlm) * 1e7));
      const cycleDuration = BigInt(parseInt(values.cycleDays, 10) * 86400);
      const maxMembers = parseInt(values.maxMembers, 10);

      await createGroup({ contributionAmount, cycleDuration, maxMembers });

      // Invalidate group list so the dashboard + GroupList refresh
      await queryClient.invalidateQueries({ queryKey: ['groups'] });

      Alert.alert('Group Created', 'Your group was created successfully!', [
        { text: 'OK', onPress: () => nav.navigate('GroupList') },
      ]);
    } catch (err) {
      const msg =
        err instanceof ContractError
          ? err.userMessage
          : err instanceof Error
          ? err.message
          : 'An unexpected error occurred.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>
          Set the terms for your savings group. These cannot be changed after creation.
        </Text>

        <Field
          label="Contribution Amount"
          value={values.contributionXlm}
          onChangeText={setField('contributionXlm')}
          error={errors.contributionXlm}
          placeholder="e.g. 100"
          keyboardType="decimal-pad"
          suffix="XLM"
        />

        <Field
          label="Cycle Duration"
          value={values.cycleDays}
          onChangeText={setField('cycleDays')}
          error={errors.cycleDays}
          placeholder="e.g. 30"
          keyboardType="number-pad"
          suffix="days"
        />

        <Field
          label="Max Members"
          value={values.maxMembers}
          onChangeText={setField('maxMembers')}
          error={errors.maxMembers}
          placeholder="e.g. 10"
          keyboardType="number-pad"
        />

        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Total pool per cycle</Text>
          <Text style={styles.summaryValue}>
            {values.contributionXlm && values.maxMembers
              ? `${(parseFloat(values.contributionXlm || '0') * parseInt(values.maxMembers || '0', 10)).toFixed(2)} XLM`
              : '—'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Create group"
          accessibilityState={{ disabled: submitting, busy: submitting }}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Create Group</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#0f1117' },
  content: { padding: 20 },
  subtitle: { fontSize: 14, color: '#9ca3af', marginBottom: 24, lineHeight: 20 },
  summary: {
    backgroundColor: '#1e2130',
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTitle: { fontSize: 14, color: '#9ca3af' },
  summaryValue: { fontSize: 18, fontWeight: '700', color: '#6366f1' },
  submitBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
