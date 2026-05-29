import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';
import yo from './locales/yo.json';

export type LanguageCode = 'en' | 'fr' | 'yo';

export const SUPPORTED_LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'yo', label: 'Yorùbá' },
];

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  yo: { translation: yo },
};

const stored = typeof window !== 'undefined' ? localStorage.getItem('stellar_save_language') : null;
const defaultLng: LanguageCode = (stored as LanguageCode) || (navigator?.language?.startsWith('fr') ? 'fr' : 'en');

void i18n.use(initReactI18next).init({
  resources,
  lng: defaultLng,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
