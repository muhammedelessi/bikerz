import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/contexts/LanguageContext';
import { stripLangPrefix } from '@/lib/i18nRouting';
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

  // Build canonical URL — if a canonical prop is provided use it,
  // otherwise derive from the current location path.
  const pagePath = canonical || location.pathname;
  const canonicalUrl = `${DOMAIN}${pagePath}`;

  // hreflang: strip any existing lang prefix to get the base path,
  // then build both /ar/ and /en/ variants.
  const basePath = stripLangPrefix(pagePath);
  const arUrl = `${DOMAIN}/ar${basePath === '/' ? '/' : basePath}`;
  const enUrl = `${DOMAIN}/en${basePath === '/' ? '/' : basePath}`;

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

      {/* hreflang — tells Google about the Arabic and English versions */}
      <link rel="alternate" hrefLang="ar" href={arUrl} />
      <link rel="alternate" hrefLang="en" href={enUrl} />
      <link rel="alternate" hrefLang="x-default" href={arUrl} />

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
