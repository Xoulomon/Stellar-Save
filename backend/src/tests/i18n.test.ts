/**
 * Lint test for i18n notification templates (#1034).
 *
 * Verifies:
 * 1. Every NotificationKey exists in every supported locale.
 * 2. No translation contains an un-interpolated `{{key}}` remnant for a
 *    variable that the English template also uses (catches copy-paste gaps).
 * 3. Fallback to 'en' never produces an untranslated key literal in output.
 */
import { t, SUPPORTED_LOCALES, SupportedLocale } from '../../lib/i18n';

const ALL_KEYS = [
  'contribution_reminder.subject',
  'contribution_reminder.body',
  'contribution_confirmed.subject',
  'contribution_confirmed.body',
  'payout_notification.subject',
  'payout_notification.body',
  'group_update.subject',
  'group_update.body',
  'member_joined.subject',
  'member_joined.body',
] as const;

const SAMPLE_VARS = {
  userName: 'Alice',
  groupName: 'Ajo Circle',
  amount: '100',
  dueDate: '2026-07-01',
  txHash: 'abc123',
  updateMessage: 'New cycle started',
  memberName: 'Bob',
  totalMembers: '5',
  maxMembers: '10',
};

describe('i18n notification templates', () => {
  describe('coverage: all keys exist in all locales', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of ALL_KEYS) {
        it(`locale="${locale}" has key="${key}"`, () => {
          // t() never returns the raw key unless explicitly missing everywhere;
          // the assertAllLocalesCoverage() call in i18n.ts would have thrown at
          // import time if a translation were absent.
          const result = t(key as any, SAMPLE_VARS, locale);
          expect(result).toBeTruthy();
          expect(result).not.toBe(key); // not returning the key itself
        });
      }
    }
  });

  describe('interpolation: no leftover {{placeholder}} in output', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of ALL_KEYS) {
        it(`locale="${locale}" key="${key}" has no leftover placeholders`, () => {
          const result = t(key as any, SAMPLE_VARS, locale);
          expect(result).not.toMatch(/\{\{\w+\}\}/);
        });
      }
    }
  });

  describe('fallback: unknown locale falls back to en', () => {
    for (const key of ALL_KEYS) {
      it(`unsupported locale falls back for key="${key}"`, () => {
        const enResult = t(key as any, SAMPLE_VARS, 'en');
        const fallbackResult = t(key as any, SAMPLE_VARS, 'zh-TW'); // unsupported
        expect(fallbackResult).toBe(enResult);
      });
    }
  });

  describe('missing variable: placeholder preserved, no crash', () => {
    it('leaves unreplaced {{placeholder}} when var is absent', () => {
      const result = t('contribution_reminder.body', { userName: 'Alice' }, 'en');
      // groupName, amount, dueDate are missing — they stay as {{...}}
      expect(result).toContain('{{groupName}}');
      expect(result).not.toContain('undefined');
    });
  });
});
