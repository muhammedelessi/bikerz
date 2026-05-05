/**
 * LanguageRouter — placed inside BrowserRouter, renders as a /:lang/* route.
 *
 * Responsibilities:
 * 1. Extract the language from the URL path (/ar/ or /en/)
 * 2. Sync it with i18n and LanguageContext
 * 3. Redirect bare "/" to /ar/ or /en/ based on user preference / geo-detection
 * 4. Skip redirect for bots (Googlebot must crawl both versions directly)
 */
import React, { useEffect } from 'react';
import { useParams, useLocation, Navigate, Outlet } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import type { SupportedLang } from '@/lib/i18nRouting';
import { isBot } from '@/lib/i18nRouting';

/**
 * Renders inside the <Route path="/:lang/*"> wrapper.
 * Reads the :lang param and syncs it with the language context.
 */
const LanguageRouter: React.FC = () => {
  const { lang } = useParams<{ lang: string }>();
  const { language, setLanguage } = useLanguage();

  // Sync URL language → context/i18n (only when they differ)
  useEffect(() => {
    if (lang && (lang === 'ar' || lang === 'en') && lang !== language) {
      setLanguage(lang as SupportedLang);
    }
  }, [lang, language, setLanguage]);

  // If somehow the :lang param is invalid, redirect to the user's preferred lang
  if (lang !== 'ar' && lang !== 'en') {
    return <Navigate to={`/${language}/`} replace />;
  }

  return <Outlet />;
};

/**
 * Redirect from bare "/" to the user's preferred language URL.
 * Bots see a simple page with links to both versions instead of a redirect,
 * so Google can discover and crawl both /ar/ and /en/.
 */
export const RootRedirect: React.FC = () => {
  const { language } = useLanguage();
  const location = useLocation();

  // Don't redirect bots — let them see both versions
  if (isBot()) {
    return (
      <div>
        <a href="/ar/">العربية</a>
        <a href="/en/">English</a>
      </div>
    );
  }

  // Preserve query string and hash
  const target = `/${language}${location.search}${location.hash}`;
  return <Navigate to={target} replace />;
};

export default LanguageRouter;
