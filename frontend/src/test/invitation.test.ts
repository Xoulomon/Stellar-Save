import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateInviteLink,
  trackInviteShare,
  getInviteShareCount,
  buildShareUrls,
} from '../utils/invitation';

// localStorage.clear is broken in this jsdom environment (--localstorage-file flag issue)
// so we stub the whole localStorage with a simple in-memory mock.
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

describe('invitation utils', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('generateInviteLink', () => {
    it('includes the groupId in the URL', () => {
      const link = generateInviteLink('group-42');
      expect(link).toContain('group-42');
      expect(link).toContain('/groups/join/');
    });

    it('generates different links for different groups', () => {
      expect(generateInviteLink('a')).not.toBe(generateInviteLink('b'));
    });
  });

  describe('trackInviteShare / getInviteShareCount', () => {
    it('starts at 0 for a new group', () => {
      expect(getInviteShareCount('new-group')).toBe(0);
    });

    it('increments count on each track call', () => {
      trackInviteShare('g1');
      expect(getInviteShareCount('g1')).toBe(1);
      trackInviteShare('g1');
      expect(getInviteShareCount('g1')).toBe(2);
    });

    it('tracks counts independently per group', () => {
      trackInviteShare('g1');
      trackInviteShare('g1');
      trackInviteShare('g2');
      expect(getInviteShareCount('g1')).toBe(2);
      expect(getInviteShareCount('g2')).toBe(1);
    });

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem('stellar_invite_usage', 'not-json');
      expect(() => getInviteShareCount('g1')).not.toThrow();
      expect(getInviteShareCount('g1')).toBe(0);
    });
  });

  describe('buildShareUrls', () => {
    it('returns twitter, whatsapp, and telegram URLs', () => {
      const urls = buildShareUrls('https://example.com/invite/1', 'My Group');
      expect(urls.twitter).toContain('twitter.com');
      expect(urls.whatsapp).toContain('wa.me');
      expect(urls.telegram).toContain('t.me');
    });

    it('encodes the invite link in each URL', () => {
      const link = 'https://example.com/groups/join/abc';
      const urls = buildShareUrls(link, 'Test');
      const encoded = encodeURIComponent(link);
      expect(urls.twitter).toContain(encoded);
      expect(urls.whatsapp).toContain(encoded);
      expect(urls.telegram).toContain(encoded);
    });

    it('encodes the group name in each URL', () => {
      const urls = buildShareUrls('https://example.com', 'My Savings Group');
      const encodedName = encodeURIComponent('My Savings Group');
      expect(urls.twitter).toContain(encodedName);
    });
  });
});
