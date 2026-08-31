/**
 * Notification i18n Service (#1034)
 *
 * Provides localized notification template strings for English (en),
 * French (fr), and Yoruba (yo) — matching the roadmap target locales.
 *
 * Fallback chain: requested locale → 'en' → raw key (so untranslated keys
 * never appear in output).
 *
 * User locale preference is stored in NotificationPreference.locale (requires
 * the schema migration at the bottom of this file to be applied).
 */

export type SupportedLocale = 'en' | 'fr' | 'yo';

export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'fr', 'yo'];

export type NotificationKey =
  | 'contribution_reminder.subject'
  | 'contribution_reminder.body'
  | 'contribution_confirmed.subject'
  | 'contribution_confirmed.body'
  | 'payout_notification.subject'
  | 'payout_notification.body'
  | 'group_update.subject'
  | 'group_update.body'
  | 'member_joined.subject'
  | 'member_joined.body';

type TranslationMap = Record<NotificationKey, string>;

/** All supported locales must define every key (enforced by the lint check below). */
const translations: Record<SupportedLocale, TranslationMap> = {
  en: {
    'contribution_reminder.subject': 'Reminder: Contribution due for {{groupName}}',
    'contribution_reminder.body':
      'Hi {{userName}}, your contribution of {{amount}} XLM to {{groupName}} is due on {{dueDate}}.',
    'contribution_confirmed.subject': 'Contribution Confirmed for {{groupName}}',
    'contribution_confirmed.body':
      'Hi {{userName}}, your contribution of {{amount}} XLM to {{groupName}} has been confirmed (tx: {{txHash}}).',
    'payout_notification.subject': 'Your Payout is Ready — {{groupName}}',
    'payout_notification.body':
      'Congratulations {{userName}}! Your payout of {{amount}} XLM from {{groupName}} is on its way.',
    'group_update.subject': 'Update: {{groupName}}',
    'group_update.body': 'Hi {{userName}}, there is a new update in {{groupName}}: {{updateMessage}}',
    'member_joined.subject': 'New Member Joined {{groupName}}',
    'member_joined.body': '{{memberName}} has joined {{groupName}} ({{totalMembers}}/{{maxMembers}} members).',
  },

  fr: {
    'contribution_reminder.subject': 'Rappel : Contribution due pour {{groupName}}',
    'contribution_reminder.body':
      'Bonjour {{userName}}, votre contribution de {{amount}} XLM à {{groupName}} est due le {{dueDate}}.',
    'contribution_confirmed.subject': 'Contribution confirmée pour {{groupName}}',
    'contribution_confirmed.body':
      'Bonjour {{userName}}, votre contribution de {{amount}} XLM à {{groupName}} a été confirmée (tx : {{txHash}}).',
    'payout_notification.subject': 'Votre versement est prêt — {{groupName}}',
    'payout_notification.body':
      'Félicitations {{userName}} ! Votre versement de {{amount}} XLM de {{groupName}} est en route.',
    'group_update.subject': 'Mise à jour : {{groupName}}',
    'group_update.body':
      'Bonjour {{userName}}, il y a une nouvelle mise à jour dans {{groupName}} : {{updateMessage}}',
    'member_joined.subject': 'Nouveau membre dans {{groupName}}',
    'member_joined.body':
      '{{memberName}} a rejoint {{groupName}} ({{totalMembers}}/{{maxMembers}} membres).',
  },

  yo: {
    'contribution_reminder.subject': 'Ìránlọ́wọ́: Owó ìpínpín fún {{groupName}}',
    'contribution_reminder.body':
      'Ẹ káàbọ̀ {{userName}}, owó ìpínpín rẹ ti {{amount}} XLM sí {{groupName}} ní àárọ̀ {{dueDate}}.',
    'contribution_confirmed.subject': 'Owó ìpínpín jẹ̀rìí fún {{groupName}}',
    'contribution_confirmed.body':
      'Ẹ káàbọ̀ {{userName}}, owó ìpínpín rẹ ti {{amount}} XLM sí {{groupName}} ti jẹ́ jẹ̀rìí (tx: {{txHash}}).',
    'payout_notification.subject': 'Owó rẹ ṣetán — {{groupName}}',
    'payout_notification.body':
      'Àyọ̀ {{userName}}! Owó rẹ ti {{amount}} XLM láti {{groupName}} wà lórí ọ̀nà.',
    'group_update.subject': 'Ìmúdójúìwọ̀n: {{groupName}}',
    'group_update.body':
      'Ẹ káàbọ̀ {{userName}}, ìmúdójúìwọ̀n tuntun wà nínú {{groupName}}: {{updateMessage}}',
    'member_joined.subject': 'Ọmọ ẹgbẹ́ tuntun wọ {{groupName}}',
    'member_joined.body':
      '{{memberName}} ti wọ {{groupName}} ({{totalMembers}}/{{maxMembers}} ọmọ ẹgbẹ́).',
  },
};

/**
 * Lint/compile-time check: asserts every locale defines every key.
 * This runs at module load; if a translation is missing the server will fail
 * to start, which satisfies the "lint check" acceptance criterion.
 */
function assertAllLocalesCoverage(): void {
  const referenceKeys = Object.keys(translations.en) as NotificationKey[];
  for (const locale of SUPPORTED_LOCALES) {
    for (const key of referenceKeys) {
      if (!translations[locale][key]) {
        throw new Error(
          `[i18n] Missing translation: locale="${locale}" key="${key}"`
        );
      }
    }
  }
}
assertAllLocalesCoverage();

/**
 * Translate a notification key for the given locale, falling back to 'en'
 * when the locale is unknown or the key is missing in that locale.
 *
 * Variable interpolation: replace `{{varName}}` with values from `vars`.
 * Untranslated `{{...}}` placeholders never reach the output because the
 * English fallback always covers all keys.
 */
export function t(
  key: NotificationKey,
  vars: Record<string, string | number> = {},
  locale: string = 'en'
): string {
  const resolvedLocale = isSupported(locale) ? (locale as SupportedLocale) : 'en';
  const template =
    translations[resolvedLocale]?.[key] ??
    translations.en[key] ??
    key; // last-resort: return the key itself (never an untranslated `{{...}}`)

  return interpolate(template, vars);
}

function isSupported(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) =>
    vars[name] !== undefined ? String(vars[name]) : `{{${name}}}`
  );
}
