import { StatusBar } from 'expo-status-bar';

import { AuthGate } from './src/auth/AuthGate';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { RootNavigator } from './src/navigation';
import { initSentry } from './src/lib/sentry';

void initSentry();

export default function App() {
  return (
    <ErrorBoundary>
      <AuthGate>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthGate>
    </ErrorBoundary>
  );
}
