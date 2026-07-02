/**
 * GroupListScreen.tsx
 *
 * Displays all groups with pull-to-refresh and status badges.
 * Tapping a group navigates to JoinGroup flow.
 */

import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useGroups } from '../hooks/useGroups';
import type { Group } from '../services/contractService';
import type { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<Group['status'], string> = {
  active: '#22c55e',
  pending: '#f59e0b',
  completed: '#6b7280',
  paused: '#ef4444',
};

function StatusBadge({ status }: { status: Group['status'] }) {
  return (
    <View style={[styles.badge, { backgroundColor: STATUS_COLORS[status] + '22' }]}>
      <View style={[styles.badgeDot, { backgroundColor: STATUS_COLORS[status] }]} />
      <Text style={[styles.badgeText, { color: STATUS_COLORS[status] }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
}

// ─── Group card ───────────────────────────────────────────────────────────────

function GroupCard({ group, onPress }: { group: Group; onPress: () => void }) {
  const xlmAmount = (group.contributionAmount / 1e7).toFixed(2);
  const cycleDays = Math.round(group.cycleDuration / 86400);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Group ${group.name ?? group.id}, status ${group.status}`}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.groupName} numberOfLines={1}>
          {group.name ?? `Group #${group.id}`}
        </Text>
        <StatusBadge status={group.status} />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Contribution</Text>
          <Text style={styles.statValue}>{xlmAmount} XLM</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Cycle</Text>
          <Text style={styles.statValue}>{cycleDays}d</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Members</Text>
          <Text style={styles.statValue}>{group.memberCount}/{group.maxMembers}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function GroupListScreen() {
  const nav = useNavigation<Nav>();
  const { groups, isLoading, error, refresh } = useGroups();

  function handleJoin(group: Group) {
    nav.navigate('JoinGroup', { groupId: group.id });
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={refresh} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={groups}
      keyExtractor={(g) => g.id}
      renderItem={({ item }) => (
        <GroupCard group={item} onPress={() => handleJoin(item)} />
      )}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refresh}
          tintColor="#6366f1"
        />
      }
      contentContainerStyle={groups.length === 0 ? styles.emptyContainer : styles.listContent}
      ListEmptyComponent={
        !isLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No groups found</Text>
            <Text style={styles.emptySubtitle}>
              Pull down to refresh or create a new group.
            </Text>
            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => nav.navigate('CreateGroup')}
            >
              <Text style={styles.createBtnText}>Create Group</Text>
            </TouchableOpacity>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#0f1117' },
  listContent: { padding: 16, gap: 12 },
  emptyContainer: { flex: 1 },
  card: {
    backgroundColor: '#1e2130',
    borderRadius: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupName: { fontSize: 16, fontWeight: '600', color: '#f9fafb', flex: 1, marginRight: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: '500' },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 15, fontWeight: '600', color: '#e5e7eb', marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1117' },
  errorText: { color: '#ef4444', fontSize: 15, textAlign: 'center', marginHorizontal: 24 },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#1e2130', borderRadius: 8 },
  retryText: { color: '#6366f1', fontWeight: '600' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#9ca3af' },
  emptySubtitle: { fontSize: 14, color: '#6b7280', marginTop: 6, textAlign: 'center', marginHorizontal: 32 },
  createBtn: { marginTop: 24, backgroundColor: '#6366f1', borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  createBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
});
