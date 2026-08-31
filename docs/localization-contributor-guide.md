# Localization and Translation Contributor Guide

This guide helps non-developers contribute translations for Stellar-Save across the web app, mobile surfaces, and notification templates.

## Scope

Stellar-Save currently uses a shared locale model for the web frontend and a separate notification i18n service for backend-generated emails and push copy. The main translation sources are:

- Frontend locale files in [frontend/src/i18n/locales](../frontend/src/i18n/locales)
- Frontend language registration in [frontend/src/i18n/index.ts](../frontend/src/i18n/index.ts)
- Backend notification translations in [backend/src/lib/i18n.ts](../backend/src/lib/i18n.ts)

## Supported locales

### Web and frontend

The frontend currently supports these locales:

| Code | Locale | Status |
|---|---|---|
| `en` | English | Default and fallback |
| `fr` | Français | Supported |
| `yo` | Yorùbá | Supported |
| `ar` | العربية | Supported |
| `fa` | فارسی | Supported |
| `sw` | Kiswahili | Supported |

### Notifications and backend templates

Backend notifications currently support:

| Code | Locale | Status |
|---|---|---|
| `en` | English | Default and fallback |
| `fr` | Français | Supported |
| `yo` | Yorùbá | Supported |

## File structure and conventions

### Frontend locale files

Each locale is a JSON file in the frontend locale folder:

```text
frontend/src/i18n/locales/
  en.json
  fr.json
  yo.json
  ar.json
  fa.json
  sw.json
```

Conventions:

- Keep the JSON structure nested by feature or page area.
- Preserve the existing keys exactly; do not rename them.
- Use the English file as the source of truth.
- Keep translations UTF-8 and valid JSON.
- Preserve interpolation variables such as `{{name}}`, `{{balance}}`, and `{{count}}` exactly.
- Do not translate product names, currency codes, wallet names, or technical identifiers.

### Backend notification templates

Notification content lives in the backend i18n module. The supported locale list and translation map are defined in [backend/src/lib/i18n.ts](../backend/src/lib/i18n.ts).

Conventions:

- Add a translation for every notification key in every supported locale.
- Keep placeholders such as `{{groupName}}` or `{{amount}}` intact.
- Prefer short, clear wording for push notifications and email subjects.

## How to add a new locale

1. Copy the English frontend locale file as a starting point:
   ```bash
   cp frontend/src/i18n/locales/en.json frontend/src/i18n/locales/<code>.json
   ```
2. Translate every value in the new file. Leave the keys unchanged.
3. Register the locale in [frontend/src/i18n/index.ts](../frontend/src/i18n/index.ts):
   - import the new JSON file
   - add it to the `SUPPORTED_LANGUAGES` array
   - add it to the `resources` object
4. If the locale should also be used for backend notifications, update [backend/src/lib/i18n.ts](../backend/src/lib/i18n.ts) and add the locale to the supported list.
5. Verify the locale by running the relevant tests and checking the language selector in the app.

## How to update an existing locale

1. Open the English source file and find the key you want to change.
2. Update the matching entry in the target locale file.
3. If a new key was added in English, add the same key to every other locale file.
4. Keep the same nesting structure and variable placeholders.

## Review process for translations

1. Use the English file as the reference source.
2. Check that the translation is natural, clear, and consistent with the product vocabulary.
3. Confirm that placeholders and punctuation remain correct.
4. Verify that the translation is not too long for UI labels or buttons.
5. Submit the change in a pull request with:
   - the locale file changes
   - any registration updates
   - a short note describing the language and scope of the update

## Verification checklist

Use this checklist before submitting a translation change:

- [ ] The JSON file is valid and parses correctly.
- [ ] The locale appears in the frontend language list when the app is run.
- [ ] The translation loads without falling back to English unexpectedly.
- [ ] Variables such as `{{name}}` and `{{count}}` still render correctly.
- [ ] Buttons, labels, and notification copy fit the available UI space.
- [ ] Backend notification templates include the locale if the locale is intended for notifications.

## Desired locales

The project already supports a strong base of global languages. Desired future additions include:

- Portuguese (`pt`)
- Spanish (`es`)
- Arabic (`ar`) and Persian (`fa`) are already included in the frontend, but may still need additional coverage work.
- Additional community-driven locales can be proposed through the normal contributor workflow.

## Quick reference

If you are only making a small translation update, follow this short path:

1. Find the English key.
2. Edit the matching translation in the target locale file.
3. Save and run the app or tests.
4. Submit the change for review.
