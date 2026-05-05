import React, { createContext, useContext, useEffect, useState } from 'react';
import i18n from 'i18next';
import { ensureLocaleLoaded } from '@/i18n';

type Language = 'en' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isRTL: boolean;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const savedLang = localStorage.getItem('i18nextLng') as Language;
      if (savedLang && (savedLang === 'en' || savedLang === 'ar')) {
        return savedLang;
      }
    } catch {
      // Ignore storage failures on restricted iOS browsers
    }
    return (i18n.language as Language) || 'ar';
  });

  const isRTL = language === 'ar';

  const setLanguage = (lang: Language) => {
    const apply = () => {
      i18n.changeLanguage(lang);
      setLanguageState(lang);
      try {
        localStorage.setItem('i18nextLng', lang);
      } catch {
        // Ignore storage failures on restricted iOS browsers
      }
    };
    // Load the target locale bundle first so the UI doesn't briefly render
    // raw translation keys. Apply immediately if it's already cached.
    if (i18n.hasResourceBundle(lang, 'translation')) {
      apply();
    } else {
      void ensureLocaleLoaded(lang).then(apply);
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  useEffect(() => {
    // Guard: wait until i18n is fully initialized before calling changeLanguage.
    if (!i18n.isInitialized) {
      const onInit = () => {
        if (i18n.language !== language) {
          i18n.changeLanguage(language);
        }
      };
      i18n.on('initialized', onInit);
      return () => { i18n.off('initialized', onInit); };
    }

    // Ensure i18n is synced on mount.
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }

    // NOTE: First-visit auto-detect lives in index.html as a synchronous
    // inline script (Fix #2 remediation Problem #5). It runs BEFORE this
    // component ever mounts, redirecting an English-browser visitor at /
    // to /en/ via window.location.replace(). Putting the redirect here
    // would make Lighthouse measure an Arabic page that then locale-
    // swaps mid-load — exactly the regression we're avoiding.
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isRTL, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
