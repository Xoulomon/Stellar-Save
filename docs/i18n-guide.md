# Internationalization (i18n) Guide

This guide covers everything you need to know to contribute translations or work on multi-language support in Stellar-Save.

---

## Table of Contents

1. [Overview](#overview)
2. [Translation Workflow](#translation-workflow)
3. [Translation File Format](#translation-file-format)
4. [Context for Translators](#context-for-translators)
5. [Translation Testing Guide](#translation-testing-guide)
6. [Language-Specific Considerations](#language-specific-considerations)
7. [Recruit Community Translators](#recruit-community-translators)

---

## Overview

Stellar-Save uses [i18next](https://www.i18next.com/) with [react-i18next](https://react.i18next.com/) for internationalization. Translation files live in:

```
frontend/src/i18n/
├── index.ts          # i18n configuration and supported languages
└── locales/
    ├── en.json       # English (source / fallback)
    ├── fr.json       # French
    └── yo.json       # Yorùbá
```

Currently supported languages:

| Code | Language | Status   |
|------|----------|----------|
| `en` | English  | Complete |
| `fr` | Français | Complete |
| `yo` | Yorùbá   | Complete |

The fallback language is always `en`. If a key is missing in a translation file, the English string is shown.

---

## Translation Workflow

### Adding a new language

1. **Create the locale file** — copy `frontend/src/i18n/locales/en.json` to a new file named with the [BCP 47 language tag](https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry) (e.g., `ha.json` for Hausa, `sw.json` for Swahili).

2. **Translate all keys** — replace every English value with the target language. Do not change the keys.

3. **Register the language** in `frontend/src/i18n/index.ts`:

   ```ts
   import ha from './locales/ha.json';

   export const SUPPORTED_LANGUAGES = [
     { code: 'en', label: 'English' },
     { code: 'fr', label: 'Français' },
     { code: 'yo', label: 'Yorùbá' },
     { code: 'ha', label: 'Hausa' },   // ← add here
   ] as const;

   i18n.use(initReactI18next).init({
     resources: {
       en: { translation: en },
       fr: { translation: fr },
       yo: { translation: yo },
       ha: { translation: ha },         // ← add here
     },
     // ...
   });
   ```

4. **Open a pull request** with the new locale file and the updated `index.ts`.

### Updating an existing translation

1. Find the key in `en.json` that needs updating.
2. Update the corresponding value in the target locale file.
3. If a new key was added to `en.json`, add the same key to all other locale files.

### Checking for missing keys

Run the following from the `frontend/` directory to list keys present in `en.json` but missing from another locale:

```bash
node -e "
const en = require('./src/i18n/locales/en.json');
const target = require('./src/i18n/locales/fr.json'); // change as needed
const flat = (obj, prefix='') => Object.entries(obj).flatMap(([k,v]) =>
  typeof v === 'object' ? flat(v, prefix+k+'.') : [prefix+k]);
const missing = flat(en).filter(k => !flat(target).includes(k));
console.log(missing.length ? missing.join('\n') : 'No missing keys');
"
```

---

## Translation File Format

Translation files are JSON with a nested namespace structure. All files must be valid JSON and use UTF-8 encoding.

### Structure

```json
{
  "namespace": {
    "key": "Translated string",
    "keyWithVariable": "Hello, {{name}}!",
    "nested": {
      "deepKey": "Another string"
    }
  }
}
```

### Current namespaces

| Namespace   | Purpose                                      |
|-------------|----------------------------------------------|
| `nav`       | Navigation labels (sidebar, tabs)            |
| `settings`  | Settings page labels and descriptions        |
| `scheduler` | Contribution scheduler UI                    |
| `common`    | Shared labels used across multiple components|

### Variables (interpolation)

Some strings contain variables wrapped in double curly braces:

```json
"balanceWarning": "Your balance ({{balance}} XLM) may be insufficient to cover all scheduled contributions ({{total}} XLM total)."
```

**Rules for variables:**
- Keep `{{variableName}}` exactly as-is — do not translate the variable name inside the braces.
- You may reorder variables within the sentence to fit natural grammar.
- Do not add or remove variables.

### Pluralization

i18next supports plural forms. If a string needs plural handling, use the `_one` / `_other` suffix convention:

```json
"member_one": "{{count}} member",
"member_other": "{{count}} members"
```

For languages with more plural forms (e.g., Arabic), use `_zero`, `_one`, `_two`, `_few`, `_many`, `_other` as needed.

---

## Context for Translators

### Domain glossary

These terms have specific meanings in Stellar-Save. Use consistent translations for them.

| English term        | Meaning                                                                 |
|---------------------|-------------------------------------------------------------------------|
| **Group**           | A ROSCA savings group on-chain                                          |
| **Contribution**    | A fixed payment made by a member each cycle                             |
| **Cycle**           | One round of contributions (e.g., weekly or monthly)                   |
| **Payout**          | The full pool distributed to one member at the end of a cycle           |
| **Member**          | A participant in a savings group                                        |
| **XLM**             | Stellar Lumens — the native currency. **Do not translate XLM.**         |
| **Wallet**          | A Stellar wallet (Freighter, Lobstr, Albedo). **Do not translate.**     |
| **Ajo / Esusu**     | Traditional West African names for ROSCA. Keep as-is or add a gloss.   |
| **Leaderboard**     | Ranking of members by contribution activity                             |
| **Schedule**        | To set a future contribution date                                       |

### Tone and register

- Use **friendly, accessible language** — the app targets community members, not financial experts.
- Avoid overly formal or bureaucratic phrasing.
- Error messages should be helpful and non-alarming (e.g., "Please select a date" rather than "Invalid input").

### What not to translate

- Currency codes: `XLM`, `USDC`, `EURC`
- Wallet names: `Freighter`, `Lobstr`, `Albedo`
- Brand name: `Stellar Save` / `Stellar-Save`
- Technical identifiers: contract IDs, addresses, transaction hashes
- Interpolation variables: `{{balance}}`, `{{total}}`, `{{name}}`

---

## Translation Testing Guide

### Manual testing

1. Start the frontend dev server:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

2. Open the app in a browser and navigate to **Settings → Language**.

3. Switch to the language you want to test.

4. Walk through each screen and verify:
   - All visible strings are translated (no English fallback showing unexpectedly).
   - Variables render correctly (e.g., balance amounts appear in the right place).
   - Long translations do not overflow or break the layout.
   - RTL languages (Arabic, Hebrew) display correctly if added.

### Automated checks

Run the existing test suite to catch regressions:

```bash
cd frontend
npm test
```

To add a test that validates all locale files have the same keys as `en.json`, create `frontend/src/i18n/locales.test.ts`:

```ts
import en from './en.json';
import fr from './fr.json';
import yo from './yo.json';

const flatKeys = (obj: object, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null
      ? flatKeys(v as object, `${prefix}${k}.`)
      : [`${prefix}${k}`]
  );

const enKeys = flatKeys(en);

describe('locale completeness', () => {
  test.each([
    ['fr', fr],
    ['yo', yo],
  ])('%s has all keys from en', (_lang, locale) => {
    const missing = enKeys.filter(k => !flatKeys(locale as object).includes(k));
    expect(missing).toEqual([]);
  });
});
```

### Visual regression

After translating, check these UI areas that are most likely to break with longer strings:

- Navigation sidebar labels
- Settings page descriptions
- Scheduler form labels and validation messages
- Balance warning banner

---

## Language-Specific Considerations

### Yorùbá (`yo`)

- Yorùbá uses tone marks (e.g., `ẹ`, `ọ`, `à`, `á`). Ensure your editor saves files as UTF-8.
- There is no standard plural form distinction — use the same string for singular and plural where natural.
- The language is spoken by ~50 million people, primarily in Nigeria and the Yoruba diaspora — a core target audience for Stellar-Save.

### French (`fr`)

- Use formal "vous" for UI instructions (e.g., "Choisissez" not "Choisis").
- French typography requires a non-breaking space before `:`, `!`, `?`, `;` — use `\u00A0` or the actual character.
- Number formatting: use a space as thousands separator and a comma as decimal separator (e.g., `1 000,50 XLM`).

### Adding Arabic (`ar`) or other RTL languages

- Set `dir="rtl"` on the `<html>` element when an RTL language is active. This can be done in `frontend/src/main.tsx` by watching the i18n language change event:

  ```ts
  i18n.on('languageChanged', (lng) => {
    document.documentElement.dir = ['ar', 'he', 'fa'].includes(lng) ? 'rtl' : 'ltr';
  });
  ```

- Arabic has six plural forms. Use the full CLDR plural key set in the locale file.
- Test all flex/grid layouts for RTL compatibility.

### Adding Hausa (`ha`) or Igbo (`ig`)

These are high-priority languages for the West African user base. Key notes:

- **Hausa**: Widely spoken across northern Nigeria, Niger, and the Sahel. Uses Latin script with some extended characters (`ƙ`, `ɗ`, `ɓ`). Ensure UTF-8 encoding.
- **Igbo**: Spoken in southeastern Nigeria. Uses Latin script with tone marks. No formal plural distinction needed for most UI strings.

---

## Recruit Community Translators

We welcome community contributions for new and existing languages. Here's how to get involved:

### For translators

1. Check [GitHub Issues](https://github.com/Xoulomon/Stellar-Save/issues) for open translation issues labeled `i18n` or `translation`.
2. Comment on the issue to claim a language so work isn't duplicated.
3. Fork the repository, add or update the locale file, and open a pull request.
4. Reference the issue number in your PR description.

### For maintainers

When a new translation PR is opened:

1. Ask a native speaker to review the PR if possible.
2. Run the locale completeness test to verify no keys are missing.
3. Test the language in the UI before merging.
4. Add the contributor to the acknowledgements section of the README.

### Priority languages

Based on the target user base (African diaspora, unbanked communities), the following languages are most impactful:

| Language | Code | Region                        |
|----------|------|-------------------------------|
| Hausa    | `ha` | Nigeria, Niger, West Africa   |
| Igbo     | `ig` | Nigeria                       |
| Swahili  | `sw` | East Africa                   |
| Amharic  | `am` | Ethiopia                      |
| Arabic   | `ar` | North Africa, Middle East     |
| Portuguese | `pt` | Brazil, Angola, Mozambique  |

If you speak any of these languages and want to contribute, open an issue or reach out via [GitHub Discussions](https://github.com/Xoulomon/Stellar-Save/discussions).
