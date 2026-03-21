import React, { createContext, useContext, useEffect, useState } from 'react';
import i18n from 'i18next';

type Language = 'en' | 'ar';

const ARAB_COUNTRIES = new Set([
  'SA', 'AE', 'KW', 'BH', 'QA', 'OM', 'EG', 'IQ', 'JO', 'LB', 'SY',
  'PS', 'YE', 'LY', 'TN', 'DZ', 'MA', 'SD', 'SO', 'MR', 'DJ', 'KM',
]);

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
    i18n.changeLanguage(lang);
    setLanguageState(lang);
    try {
      localStorage.setItem('i18nextLng', lang);
    } catch {
      // Ignore storage failures on restricted iOS browsers
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  useEffect(() => {
    // Guard: wait until i18n is fully initialized before calling changeLanguage
    if (!i18n.isInitialized) {
      const onInit = () => {
        if (i18n.language !== language) {
          i18n.changeLanguage(language);
        }
      };
      i18n.on('initialized', onInit);
      return () => { i18n.off('initialized', onInit); };
    }

    // Ensure i18n is synced on mount
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }

    // Auto-detect language from country if user hasn't manually chosen
    let hasManualChoice: string | null = null;
    try {
      hasManualChoice = localStorage.getItem('i18nextLng');
    } catch {
      hasManualChoice = null;
    }

    if (!hasManualChoice) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const options = controller ? { signal: controller.signal } : undefined;

      fetch('https://ipapi.co/country_code/', options)
        .then((res) => res.text())
        .then((code) => {
          const countryCode = code.trim().toUpperCase();
          const detectedLang: Language = ARAB_COUNTRIES.has(countryCode) ? 'ar' : 'en';
          if (detectedLang !== language) {
            setLanguage(detectedLang);
          }
        })
        .catch(() => {});

      return () => {
        controller?.abort();
      };
    }
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
