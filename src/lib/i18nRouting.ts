/**
 * i18n-aware routing utilities.
 *
 * All public-facing routes are prefixed with /:lang (ar | en).
 * System routes (admin, payment callbacks, data feeds, etc.) are exempt
 * and keep their bare paths.
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

/** Prepend the language prefix to a path, unless it's an unprefixed route. */
export function localizedPath(path: string, lang: SupportedLang): string {
  // Already has a lang prefix → return as-is
  if (/^\/(ar|en)(\/|$)/.test(path)) return path;

  // System routes → no prefix
  if (isUnprefixedPath(path)) return path;

  // External URLs → no prefix
  if (/^https?:\/\//.test(path)) return path;

  // Hash-only or empty → no prefix
  if (!path || path === '#' || path.startsWith('#')) return path;

  // Ensure leading slash
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `/${lang}${normalized}`;
}

/** Extract the language from a URL pathname, or null if none. */
export function extractLangFromPath(pathname: string): SupportedLang | null {
  const match = pathname.match(/^\/(ar|en)(\/|$)/);
  return match ? (match[1] as SupportedLang) : null;
}

/** Strip the language prefix from a pathname (e.g. /ar/courses → /courses). */
export function stripLangPrefix(pathname: string): string {
  return pathname.replace(/^\/(ar|en)(\/|$)/, '/$2') || '/';
}

/** Known bot user-agents — these must NOT be auto-redirected so Google can
 *  crawl both /ar/ and /en/ directly. */
const BOT_UA_PATTERN =
  /googlebot|bingbot|yandexbot|baiduspider|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora|showyoubot|outbrain|pinterest|slackbot|vkshare|w3c_validator/i;

export function isBot(): boolean {
  if (typeof navigator === 'undefined') return false;
  return BOT_UA_PATTERN.test(navigator.userAgent);
}
