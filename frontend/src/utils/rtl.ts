export const RTL_LANGUAGES = new Set(['ar', 'fa']);
export const isRTL = (lang: string): boolean => RTL_LANGUAGES.has(lang);
export const getDir = (lang: string): 'rtl' | 'ltr' => (isRTL(lang) ? 'rtl' : 'ltr');
