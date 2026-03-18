import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  noindex?: boolean;
  breadcrumbs?: Array<{ name: string; url: string }>;
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
}) => {
  const fullTitle = `${title} | ${SITE_NAME}`;
  const canonicalUrl = canonical ? `${DOMAIN}${canonical}` : undefined;
  const image = ogImage || DEFAULT_OG_IMAGE;

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
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />

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
