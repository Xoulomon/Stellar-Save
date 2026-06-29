import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { HomeScreen } from '../screens/HomeScreen';
import { WalletScreen } from '../screens/WalletScreen';
import { GroupDetailScreen } from '../screens/GroupDetailScreen';
import { ContributionScreen } from '../screens/ContributionScreen';
import { NotificationPreferencesScreen } from '../screens/NotificationPreferencesScreen';

export type RootTabParamList = {
  Home: undefined;
  Wallet: undefined;
  Notifications: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  GroupDetail: { groupId: string };
  Contribution: { groupId: string; contributionId?: string };
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
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
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
        <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ title: 'Group' }} />
        <Stack.Screen name="Contribution" component={ContributionScreen} options={{ title: 'Contribution' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
