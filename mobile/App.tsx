import { useRef, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainerRef } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthGate } from './src/auth/AuthGate';
import { RootNavigator, RootStackParamList } from './src/navigation';
import { usePushNotifications } from './src/notifications/usePushNotifications';

// Replace with real auth — placeholder for demo/testing
const DEMO_USER_ID = 'demo-user-1';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  const handleNotificationTap = useCallback((data: Record<string, string>) => {
    const nav = navigationRef.current;
    if (!nav) return;

    if (data.screen === 'GroupDetail' && data.groupId) {
      nav.navigate('GroupDetail', { groupId: data.groupId });
    } else if (data.screen === 'Contribution' && data.groupId) {
      nav.navigate('Contribution', {
        groupId: data.groupId,
        contributionId: data.contributionId,
      });
    }
  }, []);

  usePushNotifications(DEMO_USER_ID, handleNotificationTap);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <StatusBar style="light" />
        <RootNavigator navigationRef={navigationRef} />
      </AuthGate>
    </QueryClientProvider>
  );
}
