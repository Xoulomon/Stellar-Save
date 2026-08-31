/**
 * Deep linking utility functions for URL scheme parsing
 */

/**
 * Parse a deep link URL and extract the route path
 * Supports multiple URL schemes:
 * - stellarsave://join/ABC123
 * - https://stellarsave.app/join/ABC123
 * - https://app.stellarsave.app/join/ABC123
 */
export function parseDeepLinkUrl(url: string): string | null {
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

    return null;
  } catch {
    return null;
  }
}
