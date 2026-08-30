import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { parseDeepLinkUrl } from '../utils/deepLinking';

import type { URLOpenListenerEvent } from '@capacitor/app';

/**
 * Deep link handler hook
 * Listens for deep link events and navigates to the appropriate route
 * Handles both cold start (app not running) and warm start (app in background)
 */
export function useDeepLink() {
  const navigate = useNavigate();

  useEffect(() => {
    // Only run on native platforms
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // Handle warm start (app in background/foreground)
    const handleAppUrlOpen = (event: URLOpenListenerEvent) => {
      const url = event.url;

      const route = parseDeepLinkUrl(url);
      if (route) {
        // Small delay to ensure app is ready
        setTimeout(() => {
          navigate(route);
        }, 100);
      }
    };

    // Register listener
    const listener = App.addListener('appUrlOpen', handleAppUrlOpen);

    // Handle cold start (app not running)
    App.getLaunchUrl().then((result) => {
      if (result?.url) {
        const route = parseDeepLinkUrl(result.url);
        if (route) {
          // Delay to ensure React Router is ready
          setTimeout(() => {
            navigate(route);
          }, 500);
        }
      }
    });

    // Cleanup listener on unmount
    return () => {
      listener.remove();
    };
  }, [navigate]);
}
