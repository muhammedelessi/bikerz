import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import ar from './locales/ar.json';

const resources = {
  en: { translation: en },
  ar: { translation: ar },
};

// Set document direction based on language
const setDocumentDirection = (lng: string) => {
  const dir = lng === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = lng;
};

// Get initial language from localStorage
const getInitialLanguage = () => {
  try {
    const saved = localStorage.getItem('i18nextLng');
    if (saved === 'en' || saved === 'ar') return saved;
  } catch {
    // localStorage blocked on some iOS environments
  }
  return 'ar';
};

const initialLang = getInitialLanguage();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ar',
    lng: initialLang,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    react: {
      useSuspense: false,
    },
  });

// Set initial direction
setDocumentDirection(initialLang);

// Update direction on language change
i18n.on('languageChanged', setDocumentDirection);

export default i18n;
