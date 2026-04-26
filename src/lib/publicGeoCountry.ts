/**
 * Browser-friendly country / geo hints (avoid ipapi.co: CORS on some origins + strict rate limits).
 */

export function normalizeCountryCode(raw: string | null | undefined): string | null {
  const c = (raw ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

function countryFromIpWhoPayload(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as { success?: boolean; country_code?: string };
  if (o.success === false) return null;
  return normalizeCountryCode(o.country_code);
}

function countryFromGeoJsPayload(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as { country?: string; country_code?: string; iso_code?: string };
  return normalizeCountryCode(o.country_code || o.iso_code || o.country);
}

async function tryGeoResponse(
  url: string,
  pick: (j: unknown) => string | null,
  signal?: AbortSignal,
): Promise<string | null> {
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) return null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("json")) {
    const j: unknown = await res.json();
    return pick(j);
  }
  return normalizeCountryCode(await res.text());
}

/** ISO country code only (no city). */
export async function fetchCountryCodeFromPublicGeoApis(signal?: AbortSignal): Promise<string | null> {
  try {
    const fromIpWho = await tryGeoResponse("https://ipwho.is/", countryFromIpWhoPayload, signal);
    if (fromIpWho) return fromIpWho;
  } catch {
    /* next */
  }

  try {
    const fromGeoJs = await tryGeoResponse(
      "https://get.geojs.io/v1/ip/country-code.json",
      countryFromGeoJsPayload,
      signal,
    );
    if (fromGeoJs) return fromGeoJs;
  } catch {
    return null;
  }

  return null;
}

export type PublicGeoHint = {
  countryCode: string;
  countryName?: string;
  /** City string from provider (often English). */
  city?: string;
};

/**
 * Country + optional city/name for forms (prefers ipwho.is payload; falls back to country code only).
 */
export async function fetchPublicGeoHint(signal?: AbortSignal): Promise<PublicGeoHint | null> {
  try {
    const res = await fetch("https://ipwho.is/", signal ? { signal } : undefined);
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    if (data.success === false) return null;
    const countryCode = normalizeCountryCode(String(data.country_code ?? ""));
    if (!countryCode) return null;
    return {
      countryCode,
      countryName: typeof data.country === "string" ? data.country : undefined,
      city: typeof data.city === "string" ? data.city : undefined,
    };
  } catch {
    /* fallback */
  }

  const code = await fetchCountryCodeFromPublicGeoApis(signal);
  return code ? { countryCode: code } : null;
}
