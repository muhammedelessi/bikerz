import React, { createContext, useContext, useEffect, useState } from 'react';
import i18n from 'i18next';

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
    const savedLang = localStorage.getItem('i18nextLng') as Language;
    if (savedLang && (savedLang === 'en' || savedLang === 'ar')) {
      return savedLang;
    }
    return (i18n.language as Language) || 'ar';
  });

  const isRTL = language === 'ar';

  const setLanguage = (lang: Language) => {
    i18n.changeLanguage(lang);
    setLanguageState(lang);
    localStorage.setItem('i18nextLng', lang);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  useEffect(() => {
    // Ensure i18n is synced on mount
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
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
