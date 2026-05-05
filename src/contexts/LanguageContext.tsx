import React, { createContext, useContext, useEffect, useState } from 'react';
import i18n from 'i18next';
import { ensureLocaleLoaded } from '@/i18n';
import { fetchCountryCodeFromPublicGeoApis } from '@/lib/publicGeoCountry';

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

    // Auto-detect language from country only when:
    //   1. User has no saved preference (localStorage)
    //   2. AND the URL doesn't already have an explicit /ar/ or /en/ prefix
    // Visiting /ar/ or /en/ is an explicit language choice (shared link,
    // SEO landing) and must NOT be overridden by IP geolocation. This
    // matters especially for Lighthouse/PSI which runs from US datacenters
    // — without this guard it switches an Arabic page to English mid-load,
    // triggering an extra ~20 KB locale fetch on the LCP critical path.
    let hasManualChoice: string | null = null;
    try {
      hasManualChoice = localStorage.getItem('i18nextLng');
    } catch {
      hasManualChoice = null;
    }

    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const urlHasExplicitLang =
      path.startsWith('/ar/') || path === '/ar' ||
      path.startsWith('/en/') || path === '/en';

    if (!hasManualChoice && !urlHasExplicitLang) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

      void (async () => {
        try {
          const countryCode = await fetchCountryCodeFromPublicGeoApis(controller?.signal);
          if (!countryCode) return;
          const detectedLang: Language = ARAB_COUNTRIES.has(countryCode) ? 'ar' : 'en';
          if (detectedLang !== language) {
            setLanguage(detectedLang);
          }
        } catch {
          /* ignore */
        }
      })();

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
