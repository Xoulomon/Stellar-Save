import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '../i18n';

const STORAGE_KEY = 'stellar_save_language';

export function useI18n() {
  const { t, i18n } = useTranslation();

  const changeLanguage = useCallback(
    (code: LanguageCode) => {
      void i18n.changeLanguage(code);
      localStorage.setItem(STORAGE_KEY, code);
    },
    [i18n],
  );

  return {
    t,
    currentLanguage: i18n.language as LanguageCode,
    changeLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };
}
