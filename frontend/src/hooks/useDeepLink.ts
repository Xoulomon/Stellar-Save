import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

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
      console.log('Deep link opened (warm start):', url);
      
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
        console.log('Deep link opened (cold start):', result.url);
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

/**
 * Parse a deep link URL and extract the route path
 * Supports multiple URL schemes:
 * - stellarsave://join/ABC123
 * - https://stellarsave.app/join/ABC123
 * - https://app.stellarsave.app/join/ABC123
 */
function parseDeepLinkUrl(url: string): string | null {
  try {
    // Remove trailing slashes
    url = url.replace(/\/+$/, '');

    // Handle custom scheme (stellarsave://)
    if (url.startsWith('stellarsave://')) {
      const path = url.replace('stellarsave://', '');
      return `/${path}`;
    }

    // Handle HTTPS URLs (universal/app links)
    if (url.startsWith('https://')) {
      const urlObj = new URL(url);
      
      // Check if it's our domain
      if (
        urlObj.hostname === 'stellarsave.app' ||
        urlObj.hostname === 'app.stellarsave.app' ||
        urlObj.hostname.endsWith('.stellarsave.app')
      ) {
        // Extract pathname (e.g., /join/ABC123)
        return urlObj.pathname + urlObj.search;
      }
    }

    console.warn('Unrecognized deep link format:', url);
    return null;
  } catch (error) {
    console.error('Error parsing deep link URL:', error);
    return null;
  }
}
