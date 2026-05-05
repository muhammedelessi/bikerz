/**
 * Drop-in replacement for react-router-dom's useNavigate() that auto-prepends
 * the current language prefix (/ar/ or /en/) to paths.
 *
 * Usage:
 *   const navigate = useLocalizedNavigate();
 *   navigate('/courses');  // → navigates to /ar/courses when lang = ar
 *
 * Numeric navigation (navigate(-1)) passes through unchanged.
 * System routes (admin, payment callbacks) pass through unchanged.
 */
import { useCallback } from 'react';
import { useNavigate, type NavigateOptions } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { localizedPath } from '@/lib/i18nRouting';

export function useLocalizedNavigate() {
  const navigate = useNavigate();
  const { language } = useLanguage();

  return useCallback(
    (to: string | number, options?: NavigateOptions) => {
      if (typeof to === 'number') {
        navigate(to);
        return;
      }
      navigate(localizedPath(to, language), options);
    },
    [navigate, language],
  );
}
