import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthGate } from './src/auth/AuthGate';
import { RootNavigator } from './src/navigation';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

export default function App() {
  return (
    <AuthGate>
      <StatusBar style="light" />
      <RootNavigator />
    </AuthGate>
  );
}
