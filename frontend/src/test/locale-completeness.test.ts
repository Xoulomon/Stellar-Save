/**
 * Locale completeness test — issue #1547
 *
 * Asserts that every locale file under src/i18n/locales/ has exactly the same
 * set of translation keys as the reference locale (en.json).  Missing or extra
 * keys in any locale are caught here before they surface as runtime fallbacks.
 *
 * Key conventions:
 *   - Keys are compared as flattened dot-separated paths (e.g. "nav.dashboard").
 *   - Nested objects are recursed; leaf values are not checked (translation
 *     quality is out of scope for this test).
 *   - The test uses static imports so the same module resolution applies as in
 *     production — no filesystem-specific logic needed.
 */
import { describe, it, expect } from 'vitest';

import en from '../i18n/locales/en.json';
import fr from '../i18n/locales/fr.json';
import yo from '../i18n/locales/yo.json';
import ar from '../i18n/locales/ar.json';
import fa from '../i18n/locales/fa.json';
import sw from '../i18n/locales/sw.json';

// ── Key extraction ────────────────────────────────────────────────────────────

type JsonObject = { [k: string]: JsonValue };
type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];

/**
 * Recursively flatten all leaf-key paths from a JSON object.
 *
 * Given { "a": { "b": "value", "c": { "d": "x" } } }
 * returns ["a.b", "a.c.d"]
 *
 * Array values (if any) are treated as leaves and their index paths are NOT
 * expanded — only object keys are traversed.
 */
function flattenKeys(obj: JsonObject, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as JsonObject, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

// ── Reference key set ─────────────────────────────────────────────────────────

const referenceKeys = flattenKeys(en as JsonObject);

// ── Locales under test ────────────────────────────────────────────────────────

const locales: Array<{ code: string; data: JsonObject }> = [
  { code: 'fr', data: fr as JsonObject },
  { code: 'yo', data: yo as JsonObject },
  { code: 'ar', data: ar as JsonObject },
  { code: 'fa', data: fa as JsonObject },
  { code: 'sw', data: sw as JsonObject },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Locale completeness (issue #1547)', () => {
  it('reference locale (en) has at least one key', () => {
    expect(referenceKeys.length).toBeGreaterThan(0);
  });

  for (const { code, data } of locales) {
    describe(`locale: ${code}`, () => {
      const localeKeys = flattenKeys(data);

      it('has exactly the same number of keys as en', () => {
        expect(localeKeys.length).toBe(referenceKeys.length);
      });

      it('contains no keys missing from en (no extra keys)', () => {
        const extraKeys = localeKeys.filter((k) => !referenceKeys.includes(k));
        expect(extraKeys).toEqual([]);
      });

      it('is missing no keys that exist in en (no missing keys)', () => {
        const missingKeys = referenceKeys.filter((k) => !localeKeys.includes(k));
        expect(missingKeys).toEqual([]);
      });

      it('has the same sorted key list as en', () => {
        // Single assertion that gives the clearest diff output when it fails.
        expect(localeKeys).toEqual(referenceKeys);
      });
    });
  }
});

// ── Structural smoke test ─────────────────────────────────────────────────────

describe('Key path coverage spot-checks', () => {
  const requiredPaths = [
    'nav.dashboard',
    'nav.groups',
    'nav.profile',
    'nav.settings',
    'nav.leaderboard',
    'settings.title',
    'settings.subtitle',
    'settings.appearance',
    'settings.language',
    'settings.theme.light',
    'settings.theme.dark',
    'settings.theme.system',
    'scheduler.title',
    'scheduler.amount',
    'scheduler.validation.positiveAmount',
    'scheduler.validation.selectDate',
    'scheduler.validation.futureDate',
    'common.loading',
    'common.error',
    'common.save',
    'common.cancel',
    'common.confirm',
  ];

  it('reference (en) contains all required key paths', () => {
    for (const path of requiredPaths) {
      expect(referenceKeys).toContain(path);
    }
  });

  for (const { code, data } of locales) {
    it(`${code} contains all required key paths`, () => {
      const localeKeys = flattenKeys(data);
      for (const path of requiredPaths) {
        expect(localeKeys).toContain(path);
      }
    });
  }
});
