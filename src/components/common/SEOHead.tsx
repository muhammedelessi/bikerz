import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/contexts/LanguageContext';
import { localizedPath, stripLangPrefix } from '@/lib/i18nRouting';
import { useLocation } from 'react-router-dom';

export interface LcpPreloadLink {
  href: string;
  /** e.g. image/webp */
  type?: string;
  /** e.g. (max-width: 768px) */
  media?: string;
  crossOrigin?: 'anonymous' | 'use-credentials';
  /** Hint for the preload request (DOM attribute is `fetchpriority`) */
  fetchPriority?: 'high' | 'low' | 'auto';
}

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  noindex?: boolean;
  breadcrumbs?: Array<{ name: string; url: string }>;
  /** High-priority fetch for LCP image(s); use absolute href for CDN thumbnails */
  lcpPreloads?: LcpPreloadLink[];
}

const DOMAIN = 'https://academy.bikerz.com';
const DEFAULT_OG_IMAGE = `${DOMAIN}/og-image.jpg`;
const SITE_NAME = 'BIKERZ Academy';

const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description,
  canonical,
  ogImage,
  ogType = 'website',
  noindex = false,
  breadcrumbs,
  lcpPreloads,
}) => {
  const { language } = useLanguage();
  const location = useLocation();

  const fullTitle = `${title} | ${SITE_NAME}`;
  const image = ogImage || DEFAULT_OG_IMAGE;

  // Canonical URL — must be SELF-REFERENCING per page, not pointing to
  // a single language version. Two cases:
  //   1. `canonical` prop passed: pages historically pass it as the
  //      language-AGNOSTIC base (e.g. "/about"). We localize it to the
  //      current language so the English page canonicals to /en/about.
  //   2. No prop: use the actual location.pathname, which already has
  //      the right /en prefix on English pages.
  // Without this fix every English page canonicals to root or to the
  // Arabic URL, which tells Google "the English version is a duplicate
  // of the Arabic page" — Google then deindexes the English version.
  const canonicalPath = canonical
    ? localizedPath(canonical, language)
    : location.pathname;
  const canonicalUrl = `${DOMAIN}${canonicalPath}`;

  // hreflang: strip the language prefix from the canonical to get the
  // base, then build Arabic (bare) and English (/en) reciprocal URLs.
  // These URLs are written DIRECTLY to the static <link rel="alternate">
  // tags in index.html (see the useEffect below) instead of being added
  // via Helmet, because Helmet appends new <link rel="alternate"> tags
  // alongside the static ones — leaving validators with duplicates.
  // Writing to the existing static tags keeps a single set per page.
  const basePath = stripLangPrefix(canonicalPath);
  const arUrl = `${DOMAIN}${basePath}`;
  const enUrl = `${DOMAIN}${basePath === '/' ? '/en' : `/en${basePath}`}`;

  // Sync the static hreflang tags from index.html with the current page.
  // The inline script in index.html sets them to the right values BEFORE
  // React hydrates so validators see correct hreflang on first fetch;
  // this effect handles SPA navigation (when the user clicks an internal
  // link and the URL changes without a full reload) so the tags stay in
  // sync with the new page's reciprocal pair.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const alternates = document.querySelectorAll<HTMLLinkElement>(
      'link[rel="alternate"][hreflang]',
    );
    alternates.forEach((link) => {
      const hl = link.getAttribute('hreflang');
      if (hl === 'ar' || hl === 'x-default') {
        link.setAttribute('href', arUrl);
      } else if (hl === 'en') {
        link.setAttribute('href', enUrl);
      }
    });
  }, [arUrl, enUrl]);

  // og:locale — Arabic pages get ar_SA, English pages get en_US
  const ogLocale = language === 'ar' ? 'ar_SA' : 'en_US';
  const ogLocaleAlt = language === 'ar' ? 'en_US' : 'ar_SA';

  const breadcrumbSchema = breadcrumbs
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: `${DOMAIN}${item.url}`,
        })),
      }
    : null;

  const SafeHelmet = Helmet as unknown as React.ComponentType<{ children?: React.ReactNode }>;

  return (
    <SafeHelmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />
      <link rel="canonical" href={canonicalUrl} />

      {/* hreflang lives in index.html as static tags; the useEffect above
          syncs their hrefs on SPA navigation. Don't add them via Helmet —
          Helmet APPENDS rather than replaces, producing duplicate tags
          that validators flag as conflicting. */}

      {lcpPreloads?.map((p) => (
        <link
          key={`${p.href}${p.media ?? ''}`}
          rel="preload"
          as="image"
          href={p.href}
          {...(p.type ? { type: p.type } : {})}
          {...(p.media ? { media: p.media } : {})}
          {...(p.crossOrigin ? { crossOrigin: p.crossOrigin } : {})}
          {...(p.fetchPriority && p.fetchPriority !== 'auto'
            ? ({ fetchpriority: p.fetchPriority } as React.LinkHTMLAttributes<HTMLLinkElement>)
            : {})}
        />
      ))}

      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content={ogLocale} />
      <meta property="og:locale:alternate" content={ogLocaleAlt} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:site" content="@BIKERZ" />

      {/* Breadcrumb Schema */}
      {breadcrumbSchema && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      )}
    </SafeHelmet>
  );
};

export default SEOHead;
