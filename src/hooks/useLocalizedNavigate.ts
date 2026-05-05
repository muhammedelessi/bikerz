/**
 * Drop-in replacement for react-router-dom's useNavigate() that auto-prepends
 * the current language prefix (only /en — Arabic is the bare-path default) to paths.
 *
 * Usage:
 *   const navigate = useLocalizedNavigate();
 *   navigate('/courses');  // → '/courses' when AR, '/en/courses' when EN
 */
import { useCallback } from 'react';
import { useNavigate, type NavigateOptions, type To } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { localizedPath } from '@/lib/i18nRouting';

export function useLocalizedNavigate() {
  const navigate = useNavigate();
  const { language } = useLanguage();

  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === 'number') {
        navigate(to);
        return;
      }
      if (typeof to === 'string') {
        navigate(localizedPath(to, language), options);
        return;
      }
      // Path object — localize its pathname only
      const pathname = to.pathname ? localizedPath(to.pathname, language) : to.pathname;
      navigate({ ...to, pathname }, options);
    },
    [navigate, language],
  );
}
