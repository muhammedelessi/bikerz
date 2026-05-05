/**
 * Drop-in replacement for react-router-dom's <Link> that auto-prepends
 * the current language prefix (/ar/ or /en/) to the `to` prop.
 *
 * Usage:
 *   <LocalizedLink to="/courses">Courses</LocalizedLink>
 *   → renders <Link to="/ar/courses"> when lang = ar
 *
 * System routes (admin, payment callbacks) pass through unchanged.
 */
import React, { forwardRef } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { localizedPath } from '@/lib/i18nRouting';

export type LocalizedLinkProps = Omit<LinkProps, 'to'> & {
  to: string;
};

const LocalizedLink = forwardRef<HTMLAnchorElement, LocalizedLinkProps>(
  ({ to, ...rest }, ref) => {
    const { language } = useLanguage();
    const href = localizedPath(to, language);
    return <Link ref={ref} to={href} {...rest} />;
  },
);

LocalizedLink.displayName = 'LocalizedLink';

export default LocalizedLink;
