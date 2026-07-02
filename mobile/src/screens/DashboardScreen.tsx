/**
 * DashboardScreen.tsx
 *
 * Summarises the user's wallet balance and active group count.
 * Data comes from useBalance (Horizon) + useGroups (contract / cache).
 */

import { StyleSheet, Text, View, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useBalance } from '../hooks/useBalance';
import { useGroups } from '../hooks/useGroups';
import type { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function DashboardScreen() {
  const nav = useNavigation<Nav>();
  const {
    xlmBalance,
    isLoading: balanceLoading,
    error: balanceError,
    refresh: refreshBalance,
  } = useBalance();
  const {
    groups,
    isLoading: groupsLoading,
    error: groupsError,
    refresh: refreshGroups,
  } = useGroups();

  const isRefreshing = balanceLoading || groupsLoading;

  function onRefresh() {
    refreshBalance();
    refreshGroups();
  }

  const activeGroups = groups.filter((g) => g.status === 'active');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor="#6366f1"
        />
      }
    >
      {/* Balance card */}
      <View style={styles.card} accessibilityRole="summary" accessibilityLabel="Wallet balance">
        <Text style={styles.cardLabel}>XLM Balance</Text>
        {balanceLoading ? (
          <Text style={styles.balancePlaceholder}>—</Text>
        ) : balanceError ? (
          <Text style={styles.error}>{balanceError}</Text>
        ) : (
          <Text style={styles.balanceValue}>
            {xlmBalance ?? '0'}
            <Text style={styles.balanceUnit}> XLM</Text>
          </Text>
        )}
      </View>

      {/* Active groups summary */}
      <View style={styles.card} accessibilityRole="summary" accessibilityLabel="Active groups">
        <Text style={styles.cardLabel}>Active Groups</Text>
        {groupsLoading ? (
          <Text style={styles.balancePlaceholder}>—</Text>
        ) : groupsError ? (
          <Text style={styles.error}>{groupsError}</Text>
        ) : (
          <Text style={styles.statValue}>{activeGroups.length}</Text>
        )}
      </View>

      {/* Quick actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => nav.navigate('GroupList')}
          accessibilityRole="button"
          accessibilityLabel="View all groups"
        >
          <Text style={styles.actionBtnText}>View Groups</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={() => nav.navigate('CreateGroup')}
          accessibilityRole="button"
          accessibilityLabel="Create a new group"
        >
          <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>+ New Group</Text>
        </TouchableOpacity>
      </View>

      {/* Recent groups */}
      {activeGroups.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Groups</Text>
          {activeGroups.slice(0, 3).map((g) => (
            <View key={g.id} style={styles.groupRow}>
              <Text style={styles.groupName}>{g.name ?? `Group #${g.id}`}</Text>
              <Text style={styles.groupDetail}>
                {(g.contributionAmount / 1e7).toFixed(2)} XLM · {g.memberCount}/{g.maxMembers} members
              </Text>
            </View>
          ))}
          {activeGroups.length > 3 && (
            <TouchableOpacity onPress={() => nav.navigate('GroupList')}>
              <Text style={styles.seeAll}>See all {activeGroups.length} groups →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {!groupsLoading && groups.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptySubtitle}>
            Create or join a savings group to get started.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1117' },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#1e2130',
    borderRadius: 12,
    padding: 20,
  },
  cardLabel: { fontSize: 13, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  balancePlaceholder: { fontSize: 32, color: '#4b5563' },
  balanceValue: { fontSize: 32, fontWeight: '700', color: '#ffffff' },
  balanceUnit: { fontSize: 18, fontWeight: '400', color: '#9ca3af' },
  statValue: { fontSize: 48, fontWeight: '700', color: '#6366f1' },
  error: { fontSize: 14, color: '#ef4444' },
  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1,
    backgroundColor: '#1e2130',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionBtnPrimary: { backgroundColor: '#6366f1' },
  actionBtnText: { color: '#d1d5db', fontWeight: '600', fontSize: 15 },
  actionBtnTextPrimary: { color: '#ffffff' },
  section: { backgroundColor: '#1e2130', borderRadius: 12, padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#9ca3af', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  groupRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2d3348' },
  groupName: { fontSize: 16, fontWeight: '600', color: '#f9fafb' },
  groupDetail: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  seeAll: { fontSize: 14, color: '#6366f1', marginTop: 12, fontWeight: '500' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#9ca3af' },
  emptySubtitle: { fontSize: 14, color: '#6b7280', marginTop: 6, textAlign: 'center' },
});
