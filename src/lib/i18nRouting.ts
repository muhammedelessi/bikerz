/**
 * i18n-aware routing utilities.
 *
 * URL convention:
 *   - Arabic (default): NO prefix → /, /courses, /trainers
 *   - English:          /en prefix → /en, /en/courses, /en/trainers
 *
 * System routes (admin, payment callbacks, data feeds, etc.) are exempt.
 */

export type SupportedLang = 'ar' | 'en';

/** Routes that must NOT get a language prefix — they're either:
 *  - internal admin tools
 *  - payment system callbacks (Tap expects exact URLs)
 *  - technical endpoints (data feeds, Apple Pay verification)
 */
const UNPREFIXED_PATTERNS = [
  /^\/admin/,
  /^\/tap-3ds-callback/,
  /^\/payment-success/,
  /^\/booking-payment-complete/,
  /^\/booking-success/,
  /^\/datafeed/,
  /^\/.well-known/,
];

/** Returns true if a path should NOT get a language prefix. */
export function isUnprefixedPath(path: string): boolean {
  return UNPREFIXED_PATTERNS.some((re) => re.test(path));
}

/** Build the localized URL for a path.
 *  - Arabic → bare path (no prefix)
 *  - English → /en prefix
 */
export function localizedPath(path: string, lang: SupportedLang): string {
  // External URLs → no prefix
  if (/^https?:\/\//.test(path)) return path;

  // Hash-only or empty → no prefix
  if (!path || path === '#' || path.startsWith('#')) return path;

  // Strip any existing /en or legacy /ar prefix to get the base
  const stripped = stripLangPrefix(path);

  // System routes → no prefix
  if (isUnprefixedPath(stripped)) return stripped;

  if (lang === 'ar') {
    return stripped;
  }

  // English: prepend /en, avoid double slash when stripped is '/'
  if (stripped === '/') return '/en';
  return `/en${stripped}`;
}

/** Detect the language from a URL pathname.
 *  - /en or /en/... → 'en'
 *  - everything else → 'ar' (default)
 */
export function extractLangFromPath(pathname: string): SupportedLang {
  if (/^\/en(\/|$)/.test(pathname)) return 'en';
  return 'ar';
}

/** Strip the language prefix from a pathname.
 *  Handles both new (/en/...) and legacy (/ar/...) prefixes so old links
 *  keep working when redirected.
 */
export function stripLangPrefix(pathname: string): string {
  const stripped = pathname.replace(/^\/(ar|en)(?=\/|$)/, '');
  return stripped === '' ? '/' : stripped;
}

/** Known bot user-agents — these must NOT be auto-redirected so Google can
 *  crawl both versions directly. */
const BOT_UA_PATTERN =
  /googlebot|bingbot|yandexbot|baiduspider|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora|showyoubot|outbrain|pinterest|slackbot|vkshare|w3c_validator/i;

export function isBot(): boolean {
  if (typeof navigator === 'undefined') return false;
  return BOT_UA_PATTERN.test(navigator.userAgent);
}
