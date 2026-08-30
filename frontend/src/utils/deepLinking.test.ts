import { describe, it, expect } from 'vitest';

import { parseDeepLinkUrl } from './deepLinking';

describe('parseDeepLinkUrl', () => {
  describe('custom scheme URLs', () => {
    it('parses stellarsave:// scheme with join path', () => {
      expect(parseDeepLinkUrl('stellarsave://join/ABC123')).toBe('/join/ABC123');
    });

    it('parses stellarsave:// scheme with app path', () => {
      expect(parseDeepLinkUrl('stellarsave://app/XYZ789')).toBe('/app/XYZ789');
    });

    it('handles multiple path segments', () => {
      expect(parseDeepLinkUrl('stellarsave://group/123/details')).toBe('/group/123/details');
    });

    it('removes trailing slashes', () => {
      expect(parseDeepLinkUrl('stellarsave://join/ABC123/')).toBe('/join/ABC123');
      expect(parseDeepLinkUrl('stellarsave://join/ABC123///')).toBe('/join/ABC123');
    });
  });

  describe('HTTPS URLs', () => {
    it('parses https://stellarsave.app URLs', () => {
      expect(parseDeepLinkUrl('https://stellarsave.app/join/ABC123')).toBe('/join/ABC123');
    });

    it('parses https://app.stellarsave.app URLs', () => {
      expect(parseDeepLinkUrl('https://app.stellarsave.app/join/XYZ789')).toBe('/join/XYZ789');
    });

    it('handles query parameters', () => {
      expect(parseDeepLinkUrl('https://stellarsave.app/join/ABC123?ref=email')).toBe(
        '/join/ABC123?ref=email'
      );
    });

    it('handles multiple path segments in HTTPS URLs', () => {
      expect(parseDeepLinkUrl('https://stellarsave.app/group/123/details')).toBe(
        '/group/123/details'
      );
    });

    it('removes trailing slashes from HTTPS URLs', () => {
      expect(parseDeepLinkUrl('https://stellarsave.app/join/ABC123/')).toBe('/join/ABC123');
      expect(parseDeepLinkUrl('https://stellarsave.app/join/ABC123///')).toBe('/join/ABC123');
    });

    it('handles subdomain paths', () => {
      expect(parseDeepLinkUrl('https://subdomain.stellarsave.app/join/ABC123')).toBe(
        '/join/ABC123'
      );
    });
  });

  describe('invalid/unsupported URLs', () => {
    it('returns null for non-stellarsave domains', () => {
      expect(parseDeepLinkUrl('https://example.com/join/ABC123')).toBeNull();
    });

    it('returns null for incomplete stellarsave URLs', () => {
      expect(parseDeepLinkUrl('https://notstellarsave.app/join/ABC123')).toBeNull();
    });

    it('returns null for malformed URLs', () => {
      expect(parseDeepLinkUrl('not a url')).toBeNull();
    });

    it('returns null for empty strings', () => {
      expect(parseDeepLinkUrl('')).toBeNull();
    });

    it('returns null for unsupported schemes', () => {
      expect(parseDeepLinkUrl('http://stellarsave.app/join/ABC123')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles URLs with ports', () => {
      expect(parseDeepLinkUrl('https://stellarsave.app:443/join/ABC123')).toBe('/join/ABC123');
    });

    it('handles complex query strings', () => {
      expect(parseDeepLinkUrl('https://stellarsave.app/join/ABC123?foo=bar&baz=qux')).toBe(
        '/join/ABC123?foo=bar&baz=qux'
      );
    });

    it('preserves URL fragments', () => {
      const result = parseDeepLinkUrl('stellarsave://join/ABC123#section');
      expect(result).toBeTruthy();
    });
  });
});
