import { useEffect, ReactNode } from 'react';
import i18n from '../i18n';
import { isRTL, getDir } from '../utils/rtl';

interface RTLProviderProps {
  children: ReactNode;
}

export default function RTLProvider({ children }: RTLProviderProps) {
  const applyDir = (lang: string) => {
    const dir = getDir(lang);
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  };

  useEffect(() => {
    applyDir(i18n.language);
    i18n.on('languageChanged', applyDir);
    return () => {
      i18n.off('languageChanged', applyDir);
    };
  }, []);

  return (
    <div dir={getDir(i18n.language)} style={{ minHeight: '100%' }}>
      {children}
    </div>
  );
}
