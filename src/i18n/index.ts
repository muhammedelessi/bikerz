import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

type Lang = 'ar' | 'en';

const setDocumentDirection = (lng: string) => {
  const dir = lng === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = lng;
};

// URL prefix wins over localStorage — if the user is on /en/courses, they
// expect English regardless of their saved preference (e.g. shared link).
const getInitialLanguage = (): Lang => {
  try {
    const path = window.location.pathname;
    if (path.startsWith('/en/') || path === '/en') return 'en';
    if (path.startsWith('/ar/') || path === '/ar') return 'ar';
  } catch {
    // window unavailable in non-browser contexts
  }
  try {
    const saved = localStorage.getItem('i18nextLng');
    if (saved === 'en' || saved === 'ar') return saved;
  } catch {
    // localStorage unavailable (iOS Private Mode)
  }
  return 'ar';
};

const loadLocale = (lng: Lang): Promise<Record<string, unknown>> => {
  if (lng === 'ar') return import('./locales/ar.json').then((m) => m.default);
  return import('./locales/en.json').then((m) => m.default);
};

/**
 * Lazy-load a locale bundle if it isn't loaded yet. Call this before
 * switching language to avoid a flash of missing translations.
 */
export async function ensureLocaleLoaded(lng: Lang): Promise<void> {
  if (i18n.hasResourceBundle(lng, 'translation')) return;
  const resource = await loadLocale(lng);
  i18n.addResourceBundle(lng, 'translation', resource);
}

/**
 * Initialize i18next with only the user's current language. The other
 * language bundle (~85 kB) is fetched on-demand when the user toggles,
 * keeping it off the initial critical-path bundle.
 *
 * Called from main.tsx's bootstrap before the app renders.
 */
export async function initI18n(): Promise<void> {
  const initialLang = getInitialLanguage();
  const initialResource = await loadLocale(initialLang);

  await i18n.use(initReactI18next).init({
    resources: {
      [initialLang]: { translation: initialResource },
    },
    fallbackLng: 'ar',
    lng: initialLang,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

  setDocumentDirection(initialLang);
  i18n.on('languageChanged', setDocumentDirection);
}

export default i18n;
