/**
 * JoinGroupScreen.tsx
 *
 * Lets the user join an existing group by:
 * 1. Receiving a `groupId` route param (from GroupListScreen)
 * 2. Accepting a pasted invite link (stellarsave://join?groupId=123)
 * 3. Manual input of a numeric group ID
 *
 * Client-side validation guards against submitting clearly invalid IDs.
 * Signing is gated behind biometric/PIN via useAuthGate.
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

import { joinGroup, getGroup, ContractError, type Group } from '../services/contractService';
import { useAuthGate } from '../auth/AuthGate';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'JoinGroup'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

// Parse group ID from an invite link: stellarsave://join?groupId=123
function parseInviteLink(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.hostname === 'join' || url.pathname.includes('join')) {
      return url.searchParams.get('groupId');
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Group preview ────────────────────────────────────────────────────────────

function GroupPreview({ group }: { group: Group }) {
  const xlmAmount = (group.contributionAmount / 1e7).toFixed(2);
  const cycleDays = Math.round(group.cycleDuration / 86400);

  return (
    <View style={styles.preview}>
      <Text style={styles.previewTitle}>{group.name ?? `Group #${group.id}`}</Text>
      <View style={styles.previewRow}>
        <View style={styles.previewStat}>
          <Text style={styles.previewLabel}>Contribution</Text>
          <Text style={styles.previewValue}>{xlmAmount} XLM</Text>
        </View>
        <View style={styles.previewStat}>
          <Text style={styles.previewLabel}>Cycle</Text>
          <Text style={styles.previewValue}>{cycleDays} days</Text>
        </View>
        <View style={styles.previewStat}>
          <Text style={styles.previewLabel}>Members</Text>
          <Text style={styles.previewValue}>{group.memberCount}/{group.maxMembers}</Text>
        </View>
      </View>
      {group.status === 'active' && (
        <Text style={styles.statusWarning}>
          This group is already active — you can still join remaining slots.
        </Text>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function JoinGroupScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Props['route']>();
  const { requireAuth } = useAuthGate();
  const queryClient = useQueryClient();

  // Pre-fill group ID from route params (when tapping a group in GroupListScreen)
  const [groupIdInput, setGroupIdInput] = useState(route.params?.groupId ?? '');
  const [inputError, setInputError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Group | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Auto-lookup when a groupId is passed via route params
  useEffect(() => {
    if (route.params?.groupId) {
      void lookupGroup(route.params.groupId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookupGroup(rawInput: string) {
    // Accept invite link or raw ID
    const fromLink = parseInviteLink(rawInput);
    const resolvedId = fromLink ?? rawInput.trim();

    if (!resolvedId || isNaN(Number(resolvedId))) {
      setInputError('Enter a valid group ID (number) or paste an invite link.');
      setPreview(null);
      return;
    }
    setInputError(null);
    setLookupLoading(true);
    try {
      const group = await getGroup(resolvedId);
      if (!group) {
        setInputError('Group not found. Check the ID and try again.');
        setPreview(null);
      } else if (group.memberCount >= group.maxMembers) {
        setInputError('This group is full.');
        setPreview(null);
      } else {
        setPreview(group);
      }
    } catch (err) {
      const msg =
        err instanceof ContractError
          ? err.userMessage
          : 'Could not fetch group details. Please try again.';
      setInputError(msg);
      setPreview(null);
    } finally {
      setLookupLoading(false);
    }
  }

  function handleInputChange(text: string) {
    setGroupIdInput(text);
    setPreview(null);
    setInputError(null);
  }

  async function handleLookup() {
    await lookupGroup(groupIdInput);
  }

  async function handleJoin() {
    if (!preview) return;

    const authed = await requireAuth('Confirm joining this group');
    if (!authed) return;

    setSubmitting(true);
    try {
      await joinGroup({ groupId: BigInt(preview.id) });

      await queryClient.invalidateQueries({ queryKey: ['groups'] });

      Alert.alert('Joined!', `You have joined group "${preview.name ?? preview.id}".`, [
        { text: 'View Groups', onPress: () => nav.navigate('GroupList') },
        { text: 'Dashboard', onPress: () => nav.navigate('Dashboard') },
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
      <View style={styles.container}>
        <Text style={styles.subtitle}>
          Enter a group ID or paste an invite link to join a savings group.
        </Text>

        {/* Input row */}
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, !!inputError && styles.inputError]}
            value={groupIdInput}
            onChangeText={handleInputChange}
            placeholder="Group ID or invite link"
            placeholderTextColor="#4b5563"
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Group ID or invite link"
          />
          <TouchableOpacity
            style={styles.lookupBtn}
            onPress={handleLookup}
            disabled={lookupLoading || !groupIdInput.trim()}
            accessibilityRole="button"
            accessibilityLabel="Look up group"
          >
            {lookupLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.lookupBtnText}>Look up</Text>
            )}
          </TouchableOpacity>
        </View>

        {inputError ? (
          <Text style={styles.errorText} accessibilityLiveRegion="polite">
            {inputError}
          </Text>
        ) : null}

        {/* Group preview */}
        {preview ? <GroupPreview group={preview} /> : null}

        {/* Join button */}
        {preview ? (
          <TouchableOpacity
            style={[styles.joinBtn, submitting && styles.joinBtnDisabled]}
            onPress={handleJoin}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Join group"
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.joinBtnText}>Join Group</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#0f1117', padding: 20 },
  subtitle: { fontSize: 14, color: '#9ca3af', marginBottom: 20, lineHeight: 20 },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  input: {
    flex: 1,
    backgroundColor: '#1e2130',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2d3348',
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#f9fafb',
    fontSize: 15,
  },
  inputError: { borderColor: '#ef4444' },
  lookupBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  lookupBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  errorText: { fontSize: 13, color: '#ef4444', marginBottom: 12 },
  preview: {
    backgroundColor: '#1e2130',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 24,
  },
  previewTitle: { fontSize: 18, fontWeight: '700', color: '#f9fafb', marginBottom: 12 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  previewStat: { alignItems: 'center' },
  previewLabel: { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  previewValue: { fontSize: 15, fontWeight: '600', color: '#e5e7eb', marginTop: 4 },
  statusWarning: { fontSize: 12, color: '#f59e0b', marginTop: 12 },
  joinBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  joinBtnDisabled: { opacity: 0.6 },
  joinBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
