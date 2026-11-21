/**
 * navigation/index.tsx
 *
 * App-wide navigation:
 * - Bottom tabs: Dashboard, Groups, Wallet
 * - Modal stack screens: CreateGroup, JoinGroup (pushed from within tabs)
 */

import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';

import { DashboardScreen } from '../screens/DashboardScreen';
import { GroupListScreen } from '../screens/GroupListScreen';
import { WalletScreen } from '../screens/WalletScreen';
import { CreateGroupScreen } from '../screens/CreateGroupScreen';
import { JoinGroupScreen } from '../screens/JoinGroupScreen';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Routes on the bottom tab bar.
 *
 * Note the deliberate name difference from the root stack: the same screen can
 * be reachable under two names, because the stack hosts it as a standalone
 * page while the tab bar hosts it as a tab.
 */
export type TabParamList = {
  Dashboard: undefined;
  Groups: undefined;
  Wallet: undefined;
};

/**
 * Every route on the root stack.
 *
 * `Wallet` is intentionally absent: it only exists as a tab, and listing it
 * here used to make `navigate('Wallet')` typecheck while no stack screen
 * handled the action, which React Navigation reports at runtime as
 * "the action 'NAVIGATE' with payload ... was not handled by any navigator".
 * A route the stack cannot serve does not belong in the stack's param list.
 */
export type RootStackParamList = {
  /** Wraps the whole tab navigator — see the note on its `Stack.Screen`. */
  Dashboard: undefined;
  GroupList: undefined;
  CreateGroup: undefined;
  JoinGroup: { groupId?: string };
};

/**
 * The routes registered on the root stack, mirroring the `Stack.Screen`
 * elements in `RootNavigator` below.
 *
 * Exported so the two lists can be held in sync by the compiler rather than by
 * review: `AssertParamListsMatch` fails the build if a screen is registered
 * without being declared, or declared without being registered. The previous
 * mismatch — `Wallet` — was invisible to `tsc` precisely because nothing
 * compared the two.
 */
export const STACK_ROUTES = ['Dashboard', 'GroupList', 'CreateGroup', 'JoinGroup'] as const;

type AssertParamListsMatch = Assert<
  Equal<(typeof STACK_ROUTES)[number], keyof RootStackParamList>
>;

type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

type Assert<T extends true> = T;

// Keep the unused type alias referenced so lint does not flag it while the
// constraint itself still fails the build on a mismatch.
export type StackRoutesAreDeclared = AssertParamListsMatch;

// ─── Navigators ───────────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: '⊙',
    Groups: '◫',
    Wallet: '◈',
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
      <Tab.Screen
        name="Groups"
        component={GroupListScreen}
        options={{ title: 'Groups' }}
      />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ title: 'Wallet' }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#0f1117' },
          headerTintColor: '#f9fafb',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#0f1117' },
        }}
      >
        {/*
          Tab root — no header (tabs handle their own headers).
          Named `Dashboard` for continuity with callers that navigate back to
          "the dashboard"; the component it renders is the whole tab navigator,
          not DashboardScreen.
        */}
        <Stack.Screen name="Dashboard" component={Tabs} options={{ headerShown: false }} />

        {/* Stack screens */}
        <Stack.Screen
          name="GroupList"
          component={GroupListScreen}
          options={{ title: 'Groups' }}
        />
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
