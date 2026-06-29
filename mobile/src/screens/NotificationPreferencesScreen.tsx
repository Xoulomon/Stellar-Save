import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View, ActivityIndicator } from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
const DEMO_USER_ID = 'demo-user-1';

interface Prefs {
  contributionReminders: boolean;
  payoutNotifications: boolean;
}

async function fetchPrefs(userId: string): Promise<Prefs> {
  const res = await fetch(`${API_BASE}/api/v1/notifications/preferences/${userId}`);
  if (!res.ok) throw new Error('Failed to fetch preferences');
  return res.json();
}

async function savePrefs(userId: string, patch: Partial<Prefs>): Promise<void> {
  await fetch(`${API_BASE}/api/v1/notifications/preferences/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function NotificationPreferencesScreen() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrefs(DEMO_USER_ID)
      .then(setPrefs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function toggle(key: keyof Prefs, value: boolean) {
    setPrefs((p) => p && { ...p, [key]: value });
    await savePrefs(DEMO_USER_ID, { [key]: value }).catch(console.error);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Notification Preferences</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Contribution Reminders</Text>
        <Switch
          value={prefs?.contributionReminders ?? true}
          onValueChange={(v) => toggle('contributionReminders', v)}
          accessibilityLabel="Toggle contribution reminders"
        />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Payout Notifications</Text>
        <Switch
          value={prefs?.payoutNotifications ?? true}
          onValueChange={(v) => toggle('payoutNotifications', v)}
          accessibilityLabel="Toggle payout notifications"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, padding: 24 },
  heading: { fontSize: 18, fontWeight: '600', marginBottom: 24 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  label: { fontSize: 16 },
});
