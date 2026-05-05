/**
 * LanguageRouter — wraps public route trees and syncs the URL language
 * with the i18n / LanguageContext.
 *
 * URL convention:
 *   - Arabic (default): NO prefix — /, /courses, /dashboard
 *   - English:          /en prefix — /en, /en/courses, /en/dashboard
 *
 * Legacy /ar/* URLs are redirected to the bare path.
 */
import React, { useEffect } from 'react';
import { useLocation, Navigate, Outlet } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import type { SupportedLang } from '@/lib/i18nRouting';
import { isBot, isUnprefixedPath, stripLangPrefix } from '@/lib/i18nRouting';

interface Props {
  lang: SupportedLang;
}

/**
 * Renders inside <Route element={<LanguageRouter lang="ar"/>}> wrappers.
 * Pushes the URL's language into i18n + context.
 */
const LanguageRouter: React.FC<Props> = ({ lang }) => {
  const { language, setLanguage } = useLanguage();

  useEffect(() => {
    if (lang !== language) {
      setLanguage(lang);
    }
  }, [lang, language, setLanguage]);

  return <Outlet />;
};

/**
 * Bots see static links to both versions so they can crawl both directly.
 * Humans get the Arabic homepage at "/" — no redirect needed since Arabic
 * is the bare-path default. This component is now only used for SSR/bot
 * scenarios where we want to expose both language variants explicitly.
 */
export const RootRedirect: React.FC = () => {
  if (isBot()) {
    return (
      <div>
        <a href="/">العربية</a>
        <a href="/en">English</a>
      </div>
    );
  }
  // Humans: Arabic is the default at "/", so render the wrapper's Outlet.
  return <Outlet />;
};

/**
 * Catch-all: redirect legacy /ar/* URLs to the bare path. Anything else
 * that wasn't matched by the public routes falls through to the 404 page.
 */
export const LegacyRedirect: React.FC<{ notFoundElement: React.ReactNode }> = ({
  notFoundElement,
}) => {
  const location = useLocation();
  const { pathname, search, hash } = location;

  // Legacy /ar/* → strip to bare Arabic URL
  if (/^\/ar(\/|$)/.test(pathname)) {
    const stripped = stripLangPrefix(pathname);
    return <Navigate to={`${stripped}${search}${hash}`} replace />;
  }

  // System/admin routes — genuine 404
  if (isUnprefixedPath(pathname)) {
    return <>{notFoundElement}</>;
  }

  return <>{notFoundElement}</>;
};

export default LanguageRouter;
