import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stellarsave.app',
  appName: 'Stellar Save',
  webDir: 'dist',
  server: {
    // Allow navigation to external URLs (for web fallback)
    allowNavigation: ['stellarsave.app', '*.stellarsave.app'],
  },
};

export default config;
