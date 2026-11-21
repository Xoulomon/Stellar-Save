/**
 * Locale completeness test — issue #1547, retargeted by #1662.
 *
 * Asserts that every locale file under `src/locales/` has exactly the same set
 * of translation keys as the reference locale (en.json). Missing or extra keys
 * in any locale are caught here before they surface as runtime fallbacks.
 *
 * Scope note: these are the locales the app actually loads. `src/i18n.ts`
 * shadows any `src/i18n/` directory during module resolution, so the previous
 * six-language tree under `src/i18n/locales/` was unreachable at runtime and
 * has been removed.
 *
 * Key conventions:
 *   - Keys are compared as flattened dot-separated paths (e.g. "settings.title").
 *   - Nested objects are recursed; leaf values are not checked (translation
 *     quality is out of scope for this test).
 *   - The test uses static imports so the same module resolution applies as in
 *     production — no filesystem-specific logic needed.
 *
 * To audit which keys are actually referenced in code (and which are dead
 * weight), run: `npm run audit:i18n`.
 */
import { describe, it, expect } from 'vitest';

import en from '../locales/en.json';
import fr from '../locales/fr.json';
import yo from '../locales/yo.json';

// ── Key extraction ────────────────────────────────────────────────────────────

type JsonObject = { [k: string]: JsonValue };
type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];

/**
 * Recursively flatten all leaf-key paths from a JSON object.
 *
 * Given { "a": { "b": "value", "c": { "d": "x" } } }
 * returns ["a.b", "a.c.d"]
 *
 * Array values are treated as leaves; their index paths are not expanded.
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
  return keys;
}

const locales = [
  { code: 'en', data: en as JsonObject },
  { code: 'fr', data: fr as JsonObject },
  { code: 'yo', data: yo as JsonObject },
];

const reference = locales[0];
const referenceKeys = flattenKeys(reference.data).sort();

/**
 * Keys that production code actually looks up via `t(...)`.
 *
 * Keep in sync with `npm run audit:i18n`, which fails if a key is referenced
 * but not defined. Keys listed here must exist in every locale.
 */
const requiredPaths = [
  'settings.title',
  'settings.subtitle',
  'settings.footerText',
  'settings.appearance',
  'settings.appearanceDesc',
  'settings.language',
  'settings.languageDesc',
  'memberDirectory.title',
  'memberDirectory.copyAddress',
  'memberDirectory.copied',
  'memberDirectory.you',
  'memberDirectory.paidOut',
  'memberDirectory.contributions',
  'memberDirectory.totalPaid',
  'memberDirectory.received',
  'memberDirectory.ofMembers',
  'memberDirectory.payoutQueue',
  'memberDirectory.cycleStreak',
  'memberDirectory.searchPlaceholder',
  'memberDirectory.searchLabel',
  'memberDirectory.status',
  'memberDirectory.all',
  'memberDirectory.active',
  'memberDirectory.inactive',
  'memberDirectory.pending',
  'memberDirectory.removed',
  'memberDirectory.payout',
  'memberDirectory.receivedFilter',
  'memberDirectory.pendingFilter',
  'memberDirectory.sortBy',
  'memberDirectory.mostContributions',
  'memberDirectory.fewestContributions',
  'memberDirectory.newestMembers',
  'memberDirectory.oldestMembers',
  'memberDirectory.nameAscending',
  'memberDirectory.nameDescending',
  'memberDirectory.payoutPositionAscending',
  'memberDirectory.payoutPositionDescending',
  'memberDirectory.oneMember',
  'memberDirectory.manyMembers',
  'memberDirectory.filteredCount',
  'memberDirectory.clearFilters',
  'memberDirectory.noMatches',
  'memberDirectory.noMembers',
  'leaderboard.thisWeek',
  'leaderboard.thisMonth',
  'leaderboard.allTime',
  'leaderboard.timePeriod',
  'leaderboard.rank',
  'leaderboard.trendingUp',
  'leaderboard.trendingDown',
  'leaderboard.stable',
  'leaderboard.memberCycleSummary',
  'leaderboard.completion',
  'leaderboard.onTime',
  'leaderboard.volume',
  'leaderboard.contributed',
  'leaderboard.streak',
  'leaderboard.groupHeader',
  'leaderboard.memberHeader',
  'leaderboard.streakHeader',
  'leaderboard.topGroups',
  'leaderboard.topContributors',
  'leaderboard.noData',
  'leaderboard.updated',
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('locale completeness', () => {
  it('reference (en) is not empty', () => {
    expect(referenceKeys.length).toBeGreaterThan(0);
  });

  for (const { code, data } of locales) {
    describe(code, () => {
      it('has the same number of keys as en', () => {
        expect(flattenKeys(data).length).toBe(referenceKeys.length);
      });

      it('has no keys missing relative to en', () => {
        const localeKeys = flattenKeys(data);
        expect(localeKeys.filter((k) => !referenceKeys.includes(k))).toEqual([]);
      });

      it('has no extra keys relative to en', () => {
        const localeKeys = flattenKeys(data);
        expect(referenceKeys.filter((k) => !localeKeys.includes(k))).toEqual([]);
      });

      it('declares exactly the same key set as en', () => {
        expect([...flattenKeys(data)].sort()).toEqual(referenceKeys);
      });

      it('contains all keys required by production code', () => {
        const localeKeys = flattenKeys(data);
        for (const path of requiredPaths) {
          expect(localeKeys, `${code} is missing ${path}`).toContain(path);
        }
      });
    });
  }

  it('reference (en) contains all required key paths', () => {
    for (const path of requiredPaths) {
      expect(referenceKeys).toContain(path);
    }
  });

  it('defines no keys beyond those required by production code', () => {
    // Guards against locale files re-accumulating dead keys.
    expect(referenceKeys).toEqual([...requiredPaths].sort());
  });
});
