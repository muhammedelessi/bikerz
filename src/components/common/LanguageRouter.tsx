/**
 * LanguageRouter — placed inside BrowserRouter, renders as a /:lang/* route.
 *
 * Responsibilities:
 * 1. Extract the language from the URL path (/ar/ or /en/)
 * 2. Sync it with i18n and LanguageContext
 * 3. Redirect bare "/" to /ar/ or /en/ based on user preference / geo-detection
 * 4. Skip redirect for bots (Googlebot must crawl both versions directly)
 * 5. Backward-compat: old URLs without prefix (e.g. /courses) → /ar/courses
 */
import React, { useEffect } from 'react';
import { useParams, useLocation, Navigate, Outlet } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import type { SupportedLang } from '@/lib/i18nRouting';
import { isBot, isUnprefixedPath } from '@/lib/i18nRouting';

/**
 * Renders inside the <Route path="/:lang/*"> wrapper.
 * Reads the :lang param and syncs it with the language context.
 */
const LanguageRouter: React.FC = () => {
  const { lang } = useParams<{ lang: string }>();
  const { language, setLanguage } = useLanguage();
  const location = useLocation();

  // Sync URL language → context/i18n (only when they differ)
  useEffect(() => {
    if (lang && (lang === 'ar' || lang === 'en') && lang !== language) {
      setLanguage(lang as SupportedLang);
    }
  }, [lang, language, setLanguage]);

  // If the :lang param is not a valid language, this is likely an old URL
  // without a language prefix (e.g. /courses, /about, /trainers).
  // Redirect to the same path with the user's preferred language prefix.
  if (lang !== 'ar' && lang !== 'en') {
    const { pathname, search, hash } = location;
    return <Navigate to={`/${language}${pathname}${search}${hash}`} replace />;
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

/**
 * Backward-compat catch-all: handles old multi-segment URLs that aren't
 * caught by the /:lang route (e.g. /courses/some-id, /trainers/123).
 *
 * Logic:
 * - If the path already has /ar/ or /en/ prefix → it's a genuine 404
 * - If the path is a system/admin route → genuine 404
 * - Otherwise → redirect to /{preferred-lang}{path}
 *
 * This replaces the plain <NotFound /> catch-all so old bookmarked URLs
 * and Google-indexed links keep working after the i18n migration.
 */
export const LegacyRedirect: React.FC<{ notFoundElement: React.ReactNode }> = ({
  notFoundElement,
}) => {
  const { language } = useLanguage();
  const location = useLocation();
  const { pathname, search, hash } = location;

  // Already has a valid language prefix — this is a real 404
  if (/^\/(ar|en)(\/|$)/.test(pathname)) {
    return <>{notFoundElement}</>;
  }

  // System/admin routes that should never get prefixed — real 404
  if (isUnprefixedPath(pathname)) {
    return <>{notFoundElement}</>;
  }

  // Old URL without lang prefix → redirect with preferred language
  return <Navigate to={`/${language}${pathname}${search}${hash}`} replace />;
};

export default LanguageRouter;
