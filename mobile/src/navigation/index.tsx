/**
 * navigation/index.tsx
 *
 * App-wide navigation:
 * - Bottom tabs: Dashboard, Groups, Wallet, Notifications
 * - Stack screens: GroupDetail, Contribution (push notification deep-links)
 * - Modal stack screens: CreateGroup, JoinGroup (pushed from within tabs)
 */

import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Text } from 'react-native';

import { DashboardScreen } from '../screens/DashboardScreen';
import { GroupListScreen } from '../screens/GroupListScreen';
import { WalletScreen } from '../screens/WalletScreen';
import { GroupDetailScreen } from '../screens/GroupDetailScreen';
import { ContributionScreen } from '../screens/ContributionScreen';
import { NotificationPreferencesScreen } from '../screens/NotificationPreferencesScreen';
import { CreateGroupScreen } from '../screens/CreateGroupScreen';
import { JoinGroupScreen } from '../screens/JoinGroupScreen';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TabParamList = {
  Dashboard: undefined;
  Groups: undefined;
  Wallet: undefined;
  Notifications: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  GroupDetail: { groupId: string };
  Contribution: { groupId: string; contributionId?: string };
  CreateGroup: undefined;
  JoinGroup: { groupId?: string };
};

// ─── Navigators ───────────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: '⊙',
    Groups: '◫',
    Wallet: '◈',
    Notifications: '🔔',
  };
  return (
    <Text style={{ fontSize: 18, color: focused ? '#6366f1' : '#6b7280' }}>
      {icons[name] ?? '•'}
    </Text>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: { backgroundColor: '#1e2130', borderTopColor: '#2d3348' },
        headerStyle: { backgroundColor: '#0f1117' },
        headerTintColor: '#f9fafb',
        headerTitleStyle: { fontWeight: '700' },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Groups" component={GroupListScreen} options={{ title: 'Groups' }} />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ title: 'Wallet' }} />
      <Tab.Screen
        name="Notifications"
        component={NotificationPreferencesScreen}
        options={{ title: 'Alerts' }}
      />
    </Tab.Navigator>
  );
}

interface RootNavigatorProps {
  navigationRef?: React.RefObject<NavigationContainerRef<RootStackParamList>>;
}

export function RootNavigator({ navigationRef }: RootNavigatorProps) {
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#0f1117' },
          headerTintColor: '#f9fafb',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#0f1117' },
        }}
      >
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ title: 'Group' }} />
        <Stack.Screen name="Contribution" component={ContributionScreen} options={{ title: 'Contribution' }} />
        <Stack.Screen
          name="CreateGroup"
          component={CreateGroupScreen}
          options={{ title: 'Create Group', presentation: 'modal' }}
        />
        <Stack.Screen
          name="JoinGroup"
          component={JoinGroupScreen}
          options={{ title: 'Join Group', presentation: 'modal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
